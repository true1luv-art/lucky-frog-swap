/**
 * POST /api/farm/action
 *
 * Core server-side farm action handler. §2.2-C / §2.3
 *
 * Sprint 2.3 changes:
 * - Crop/resource actions (plant, harvest, chop, mine*) are routed to the
 *   server-safe validators in lib/events/farm-action/validate.ts, which:
 *   (a) apply stamina regen before checking costs (§2.3-D);
 *   (b) validate server-side inventory, timestamps, field unlock (§2.3-A–E);
 *   (c) throw proper errors instead of returning stale state silently.
 * - All other actions (sell, cook, fish, animals, wallet, …) still go through
 *   processGameEvent. Because processGameEvent catches errors silently, those
 *   actions returning the original state is acceptable until Sprint 2.4 adds
 *   server-safe validators for animals/cooking/fishing.
 *
 * Request body:
 *   { type: string; payload?: Record<string,unknown>; createdAt?: number }
 *
 * Response:
 *   { success: true, state: GameState, lastSyncAt: number }   — on success
 *   { success: false, error: string, code: string }           — on validation failure
 *
 * Auth: Bearer token or rhf_token cookie.
 *
 * Performance budget — §2.6-B:
 *   P95 target: < 200 ms end-to-end.
 *   Hot path breakdown:
 *     - getWallet (JWT verify):          ~1–2 ms
 *     - 3× parallel MongoDB reads:      ~10–30 ms  (covered by playerId indexes)
 *     - dispatchServerAction (pure fn):  ~0–1 ms
 *     - persistFarmChanges ($set diff):  ~10–30 ms
 *   Total budget consumed: ~25–65 ms typical; 200 ms P95 is comfortable.
 *   If MongoDB latency grows (e.g. Atlas tier change), add read concern "local"
 *   and reduce writeConcern to w:1 for the farm action path.
 */

import { getWallet }              from "@/lib/api/get-wallet";
import { apiError, apiOk }        from "@/lib/api/error-response";
import { getOrCreateFarm }        from "@/lib/modules/farms/repository.server";
import { getOrCreateInventory }   from "@/lib/modules/items/repository.server";
import { findPlayerByWallet }     from "@/lib/modules/players/repository.server";
import { ToolInstanceModel }      from "@/lib/modules/tools/model.server";
import type { IToolInstance }     from "@/lib/modules/tools/types.server";
import { buildServerGameState }   from "@/features/farm-action/build-state";
import { persistFarmChanges }     from "@/features/farm-action/persist";
import {
  serverPlant,
  serverHarvest,
  serverWaterField,
  serverChop,
  serverMine,
  serverFeedChicken,
  serverFeedCow,
  serverFeedSheep,
  serverCollectEgg,
  serverCollectMilk,
  serverCollectWool,
  serverCatchFish,
  serverCookFood,
  serverFarmUpgrade,
  serverCraftCoal,
  serverSmeltOre,
  serverCraftTool,
} from "@/features/farm-action/validate";
import type { OreType } from "@/features/types/gameplay/resources";
import { purchase }           from "@/features/events/purchase/purchase";
import { processGameEvent }   from "@/features/events";
import type { GameAction }             from "@/features/events";
import type { GameState }              from "@/features/types/gameplay/game";
// ---------------------------------------------------------------------------
// Decimal serialiser (inventory values are Decimal instances)
// ---------------------------------------------------------------------------
function serialiseState(state: unknown): unknown {
  return JSON.parse(
    JSON.stringify(state, (_k, v) =>
      v && typeof v === "object" && "d" in v && v.constructor?.name === "Decimal"
        ? { __decimal: v.toString() }
        : v,
    ),
  );
}

// ---------------------------------------------------------------------------
// §2.3 — Server-validated action dispatcher
//
// Returns { nextState, usedServerValidator } where:
//   usedServerValidator = true  → the validator already throws on failure
//   usedServerValidator = false → processGameEvent was used (silent on failure)
// ---------------------------------------------------------------------------
function dispatchServerAction(
  oldState:          GameState,
  action:            GameAction,
  createdAt:         number,
  playerLastCastAt:  number = 0,
): GameState {
  switch (action.type) {
    // §2.3-A/E — plant (field unlock + inventory check)
    case "item.planted":
      return serverPlant(oldState, action as Parameters<typeof serverPlant>[1], createdAt);

    // §2.3-B — harvest (maturity + yield via server timestamps)
    case "item.harvested":
      return serverHarvest(oldState, action as Parameters<typeof serverHarvest>[1], createdAt);

    // §2.3-F — water field (sets wateredAt + isWatered; readiness = wateredAt + growthMs)
    case "field.watered":
      return serverWaterField(oldState, action as Parameters<typeof serverWaterField>[1], createdAt);

    // §2.3-C — tree chop (recovery time via server choppedAt)
    case "tree.chopped":
      return serverChop(oldState, action as Parameters<typeof serverChop>[1], createdAt);

    // §2.3-C — single stone node; biome loot table determines ore drops
    case "stone.mined":
      return serverMine(oldState, action as Parameters<typeof serverMine>[1], createdAt);

    // §2.4-A — animal feed
    case "chicken.feed":
      return serverFeedChicken(oldState, action as Parameters<typeof serverFeedChicken>[1], createdAt);
    case "cow.feed":
      return serverFeedCow(oldState, action as Parameters<typeof serverFeedCow>[1], createdAt);
    case "sheep.feed":
      return serverFeedSheep(oldState, action as Parameters<typeof serverFeedSheep>[1], createdAt);

    // §2.4-B — animal produce collection
    case "chicken.collectEgg":
      return serverCollectEgg(oldState, action as Parameters<typeof serverCollectEgg>[1], createdAt);
    case "cow.collectMilk":
      return serverCollectMilk(oldState, action as Parameters<typeof serverCollectMilk>[1], createdAt);
    case "sheep.collectWool":
      return serverCollectWool(oldState, action as Parameters<typeof serverCollectWool>[1], createdAt);

    // §2.4-C — fishing (cooldown validated against player.activity.lastCastAt)
    case "fish.caught":
      return serverCatchFish(
        oldState,
        action as Parameters<typeof serverCatchFish>[1],
        createdAt,
        playerLastCastAt,
      );

    // §2.4-D (instant) — cook food
    case "food.cook":
      return serverCookFood(oldState, action as Parameters<typeof serverCookFood>[1], createdAt);

    // Shop purchases (seeds, foods, and animals) deduct Game Balance.
    case "item.crafted": {
      const purchaseAction = action as { type: "item.crafted"; item: string; amount: number };
      return purchase({ state: oldState, action: purchaseAction as Parameters<typeof purchase>[0]["action"] });
    }

    // Farm upgrade — deducts $LFRG coins at live on-chain price, increments farmLevel.
    // lfrgCost is passed from the client (fetched from /api/price/lfrg beforehand).
    // The server re-validates the amount is a positive integer.
    case "farm.upgrade": {
      const upgradeAction = action as { type: "farm.upgrade"; lfrgCost: number };
      if (!Number.isInteger(upgradeAction.lfrgCost) || upgradeAction.lfrgCost <= 0) {
        throw new Error("Invalid lfrgCost — must be a positive integer");
      }
      return serverFarmUpgrade(oldState, upgradeAction.lfrgCost);
    }

    // §2.5-A — craft coal (2 Wood → 1 Coal, 30 s cooldown, 125 smithing XP)
    case "coal.crafted":
      return serverCraftCoal(oldState, action as Parameters<typeof serverCraftCoal>[1], createdAt);

    // §2.5-B — smelt ore (10 ore + 1 Coal → 1 Ingot, 125 smithing XP)
    case "ore.smelted":
      return serverSmeltOre(
        oldState,
        action as { type: "ore.smelted"; ore: OreType; amount: number },
        createdAt,
      );

    // §2.5-C — craft tool (Wood tools free + max-1; ore tools cost Ingots)
    case "tool.crafted":
      return serverCraftTool(oldState, action as Parameters<typeof serverCraftTool>[1], createdAt);

    // Sell / wallet / UI actions — still use processGameEvent (Sprint 2.5)
    default: {
      // processGameEvent catches internally; re-wrap to detect no-op.
      const nextState = processGameEvent(oldState, { action, createdAt });
      return nextState;
    }
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // 1. Auth
  const wallet = await getWallet(req);
  if (!wallet) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  // 2. Parse body
  let body: { type?: string; payload?: Record<string, unknown>; createdAt?: number };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_JSON", 400);
  }

  if (!body.type) {
    return apiError("action.type is required", "MISSING_ACTION_TYPE", 400);
  }

  // 3. Load server state from MongoDB (not trusted from client).
  const [player, farm, inventory, toolDocs] = await Promise.all([
    findPlayerByWallet(wallet),
    getOrCreateFarm(wallet),
    getOrCreateInventory(wallet),
    ToolInstanceModel.find({ owner: wallet }).lean<IToolInstance[]>(),
  ]);

  if (!player) {
    return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
  }

  const oldState = buildServerGameState(
    farm,
    inventory,
    player as Parameters<typeof buildServerGameState>[2],
    toolDocs,
  );

  // 4. Build the GameEvent — spread payload into action so all fields are present
  const action: GameAction = {
    type: body.type,
    ...(body.payload ?? {}),
  } as unknown as GameAction;


  const createdAt = body.createdAt ?? Date.now();

  // 5. Dispatch — server-validated for crop/resource, processGameEvent for others
  let newState: GameState;
  try {
    newState = dispatchServerAction(oldState, action, createdAt, player.activity?.lastCastAt ?? 0);
  } catch (err) {
    // Server validators throw descriptive errors; return 422 so the client
    // can display the error and roll back its optimistic local state.
    return apiError(
      (err as Error).message ?? "Action failed",
      "ACTION_FAILED",
      422,
    );
  }

  // 6. Persist the diff atomically (no-op if state is unchanged)
  try {
    await persistFarmChanges(wallet, oldState, newState);
  } catch (err) {
    console.error("[farm/action] persistFarmChanges error:", err);
    return apiError("Failed to persist farm state", "PERSIST_ERROR", 500);
  }

  // 6b. For fishing, write the activity timestamp to the player document.
  // This is separate from the farm document — player.activity tracks anti-cheat
  // timing across farm resets.
  if (action.type === "fish.caught") {
    try {
      const { PlayerModel } = await import("@/lib/modules/players/model.server");
      await PlayerModel.findOneAndUpdate(
        { wallet },
        { $set: { "activity.lastCastAt": createdAt } },
      );
    } catch (err) {
      console.error("[farm/action] failed to update player.activity.lastCastAt:", err);
      // Non-fatal — inventory was already persisted; just log.
    }
  }

  // 7. Return updated server state
  return apiOk({
    state:      serialiseState(newState),
    lastSyncAt: Date.now(),
  });
}

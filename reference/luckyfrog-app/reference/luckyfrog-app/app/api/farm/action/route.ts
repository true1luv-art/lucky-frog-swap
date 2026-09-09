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
 * Auth: Bearer token or lfrg_token cookie.
 *
 * Performance budget — §2.6-B:
 *   P95 target: < 200 ms end-to-end.
 *   Hot path breakdown:
 *     - getWallet (JWT verify):          ~1–2 ms
 *     - 3× parallel MongoDB reads:      ~10–30 ms  (covered by playerId indexes)
 *     - dispatchServerAction (pure fn):  ~0–1 ms
 *     - checkAndGrantAchievements:       ~0–1 ms
 *     - persistFarmChanges ($set diff):  ~10–30 ms
 *   Total budget consumed: ~25–65 ms typical; 200 ms P95 is comfortable.
 *   If MongoDB latency grows (e.g. Atlas tier change), add read concern "local"
 *   and reduce writeConcern to w:1 for the farm action path.
 */

import { getWallet }              from "@/lib/api/get-wallet";
import { apiError, apiOk }        from "@/lib/api/error-response";
import { getOrCreateFarm }        from "@/lib/modules/farms/repository.server";
import { getOrCreateInventory }   from "@/lib/modules/inventories/repository.server";
import { findPlayerByWallet }     from "@/lib/modules/players/repository.server";
import { buildServerGameState }   from "@/lib/events/farm-action/build-state";
import { persistFarmChanges }     from "@/lib/events/farm-action/persist";
import {
  serverPlant,
  serverHarvest,
  serverChop,
  serverMineStone,
  serverMineIron,
  serverMineGold,
  serverFeedChicken,
  serverFeedCow,
  serverFeedSheep,
  serverCollectEgg,
  serverCollectMilk,
  serverCollectWool,
  serverCatchFish,
  serverStartCooking,
  serverCollectCooked,
} from "@/lib/events/farm-action/validate";
import { craft }                       from "@/lib/events/craft/craft";
import {
  craftCollectible,
  getOwnedCollectibleNames,
} from "@/lib/modules/collectibles/service.server";
import { processGameEvent }            from "@/lib/events";
import type { GameAction }             from "@/lib/events";
import type { GameState }              from "@/shared/types/gameplay/game";
import { checkAndGrantAchievements }   from "@/lib/modules/farms/achievements";

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
  oldState:  GameState,
  action:    GameAction,
  createdAt: number,
): GameState {
  switch (action.type) {
    // §2.3-A/E — plant (field unlock + inventory check)
    case "item.planted":
      return serverPlant(oldState, action as Parameters<typeof serverPlant>[1], createdAt);

    // §2.3-B — harvest (maturity + yield via server timestamps)
    case "item.harvested":
      return serverHarvest(oldState, action as Parameters<typeof serverHarvest>[1], createdAt);

    // §2.3-C — tree chop (recovery time via server choppedAt)
    case "tree.chopped":
      return serverChop(oldState, action as Parameters<typeof serverChop>[1], createdAt);

    // §2.3-C — stone / iron / gold (recovery via server minedAt)
    case "stone.mined":
      return serverMineStone(oldState, action as Parameters<typeof serverMineStone>[1], createdAt);
    case "iron.mined":
      return serverMineIron(oldState, action as Parameters<typeof serverMineIron>[1], createdAt);
    case "gold.mined":
      return serverMineGold(oldState, action as Parameters<typeof serverMineGold>[1], createdAt);

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

    // §2.4-C — fishing
    case "fish.caught":
      return serverCatchFish(oldState, action as Parameters<typeof serverCatchFish>[1], createdAt);

    // §2.4-D — cooking
    case "food.startCooking":
      return serverStartCooking(oldState, action as Parameters<typeof serverStartCooking>[1], createdAt);
    case "food.collectCooked":
      return serverCollectCooked(oldState, action as Parameters<typeof serverCollectCooked>[1], createdAt);

    // Shop purchases (seeds, foods, and animals) deduct Game Balance.
    // Collectible forging uses a dedicated action introduced with that system.
    case "item.crafted": {
      const craftAction = action as { type: "item.crafted"; item: string; amount: number };
      return craft({ state: oldState, action: craftAction as Parameters<typeof craft>[0]["action"] });
    }

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

  // 3. Load server state from MongoDB (not trusted from client)
  const [player, farm, inventory, ownedCollectibles] = await Promise.all([
    findPlayerByWallet(wallet),
    getOrCreateFarm(wallet),
    getOrCreateInventory(wallet),
    getOwnedCollectibleNames(wallet),
  ]);

  if (!player) {
    return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
  }

  const oldState = buildServerGameState(
    farm,
    inventory,
    player as Parameters<typeof buildServerGameState>[2],
    ownedCollectibles,
  );

  // 4. Build the GameEvent — spread payload into action so all fields are present
  const action: GameAction = {
    type: body.type,
    ...(body.payload ?? {}),
  } as unknown as GameAction;

  const createdAt = body.createdAt ?? Date.now();

  // Collectible forging owns its transaction because inventory deductions,
  // finite-supply reservation, and unique-document insertion must commit or
  // roll back together. It intentionally bypasses generic farm diff persistence.
  if (action.type === "collectible.crafted") {
    try {
      const collectible = await craftCollectible(wallet, action);
      const [freshInventory, freshOwnedCollectibles] = await Promise.all([
        getOrCreateInventory(wallet),
        getOwnedCollectibleNames(wallet),
      ]);
      const newState = buildServerGameState(
        farm,
        freshInventory,
        player as Parameters<typeof buildServerGameState>[2],
        freshOwnedCollectibles,
      );

      return apiOk({
        state: serialiseState(newState),
        collectible,
        lastSyncAt: Date.now(),
      });
    } catch (err) {
      return apiError(
        (err as Error).message ?? "Collectible forging failed",
        "COLLECTIBLE_CRAFT_FAILED",
        422,
      );
    }
  }

  // 5. Dispatch — server-validated for crop/resource, processGameEvent for others
  let newState: GameState;
  try {
    newState = dispatchServerAction(oldState, action, createdAt);
  } catch (err) {
    // Server validators throw descriptive errors; return 422 so the client
    // can display the error and roll back its optimistic local state.
    return apiError(
      (err as Error).message ?? "Action failed",
      "ACTION_FAILED",
      422,
    );
  }

  // 5b. §2.5-C — check achievements against the new state and auto-grant rewards.
  // This may further mutate balance, inventory, and achievements; those diffs
  // are captured by persistFarmChanges below together with the action diff.
  newState = checkAndGrantAchievements(newState);

  // 6. Persist the diff atomically (no-op if state is unchanged)
  try {
    await persistFarmChanges(wallet, oldState, newState);
  } catch (err) {
    console.error("[farm/action] persistFarmChanges error:", err);
    return apiError("Failed to persist farm state", "PERSIST_ERROR", 500);
  }

  // 7. Return updated server state
  return apiOk({
    state:      serialiseState(newState),
    lastSyncAt: Date.now(),
  });
}

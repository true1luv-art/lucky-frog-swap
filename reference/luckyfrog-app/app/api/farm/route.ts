/**
 * GET /api/farm
 *
 * Returns the authenticated player's farm state as a serialised `GameState`
 * ready for direct hydration into the Phaser store.
 *
 * If no farm document exists for this player it is created on-demand from
 * `createInitialFarm` / `createInitialInventory`. §2.2-E / §2.2-A
 *
 * Response shape: { success: true, state: GameState, lastSyncAt: number }
 * The `state` object has Decimal values serialised as plain strings via
 * the store's decimalReplacer so the client can revive them safely.
 *
 * Auth: Bearer token or rhf_token cookie.
 */

import { getWallet }           from "@/lib/api/get-wallet";
import { apiError, apiOk }     from "@/lib/api/error-response";
import { getOrCreateFarm } from "@/lib/modules/farms/repository.server";
import { getOrCreateInventory } from "@/lib/modules/items/repository.server";
import { findPlayerByWallet }  from "@/lib/modules/players/repository.server";
import { getTools } from "@/lib/modules/tools/repository.server";
import { buildServerGameState } from "@/features/farm-action/build-state";
export async function GET(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  const player = await findPlayerByWallet(wallet);
  if (!player) {
    return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
  }

  const [farm, inventory, toolDocs] = await Promise.all([
    getOrCreateFarm(wallet),
    getOrCreateInventory(wallet),
    getTools(wallet),
  ]);

  const state = buildServerGameState(
    farm,
    inventory,
    player,
    toolDocs,
  );

  // Serialise Decimal values to strings for JSON transport.
  // The Phaser store's merge() reviver will restore them to Decimal on the client.
  const stateJson = JSON.parse(
    JSON.stringify(state, (_k, v) =>
      v && typeof v === "object" && "d" in v && v.constructor?.name === "Decimal"
        ? { __decimal: v.toString() }
        : v,
    ),
  );

  return apiOk({ state: stateJson, lastSyncAt: Date.now() });
}

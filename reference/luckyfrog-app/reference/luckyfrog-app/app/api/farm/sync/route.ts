/**
 * POST /api/farm/sync
 *
 * Full farm state sync — called on page load to ensure the server farm document
 * exists and return the canonical server state to the client. §2.2-A / §2.2-E
 *
 * Idempotent: if the farm already exists it just returns the current state.
 * The client merges the returned state with its local Zustand store (server wins
 * for numeric values; local wins for cosmetics / animations).
 *
 * Body: optional { localState?: GameState } — ignored in Sprint 2.2;
 *       reserved for Sprint 2.5-E (localStorage migration).
 *
 * Response: { success: true, state: GameState, lastSyncAt: number }
 */

import { getWallet }            from "@/lib/api/get-wallet";
import { apiError, apiOk }      from "@/lib/api/error-response";
import { getOrCreateFarm }      from "@/lib/modules/farms/repository.server";
import { getOrCreateInventory } from "@/lib/modules/inventories/repository.server";
import { findPlayerByWallet }   from "@/lib/modules/players/repository.server";
import { buildServerGameState } from "@/lib/events/farm-action/build-state";
import { getOwnedCollectibleNames } from "@/lib/modules/collectibles/service.server";

export async function POST(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  const player = await findPlayerByWallet(wallet);
  if (!player) {
    return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
  }

  // getOrCreate ensures the farm and inventory exist, creating them if not.
  const [farm, inventory, ownedCollectibles] = await Promise.all([
    getOrCreateFarm(wallet),
    getOrCreateInventory(wallet),
    getOwnedCollectibleNames(wallet),
  ]);

  const state = buildServerGameState(
    farm,
    inventory,
    player as Parameters<typeof buildServerGameState>[2],
    ownedCollectibles,
  );

  const stateJson = JSON.parse(
    JSON.stringify(state, (_k, v) =>
      v && typeof v === "object" && "d" in v && v.constructor?.name === "Decimal"
        ? { __decimal: v.toString() }
        : v,
    ),
  );

  return apiOk({ state: stateJson, lastSyncAt: Date.now() });
}

/**
 * GET /api/farm/inventory
 *
 * Returns the authenticated player's farming inventory (items + balance).
 * Distinct from GET /api/inventory which returns the frog/egg/shard inventory. §2.2-A
 *
 * Response: { success: true, items: Record<string,number>, balance: number }
 *
 * Auth: Bearer token or lfrg_token cookie.
 */

import { getWallet }            from "@/lib/api/get-wallet";
import { apiError, apiOk }      from "@/lib/api/error-response";
import { getOrCreateInventory } from "@/lib/modules/inventories/repository.server";

export async function GET(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  const inventory = await getOrCreateInventory(wallet);

  return apiOk({
    items:   (inventory.items ?? {}) as Record<string, number>,
    balance: inventory.balance ?? 0,
  });
}

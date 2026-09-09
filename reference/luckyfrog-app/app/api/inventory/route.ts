/**
 * GET /api/inventory?wallet=<address>
 *
 * Returns the player's shard inventory split by category:
 *
 *   {
 *     items:       [],
 *     shards:      [{ type, amount }],          // rarity-based quest rewards (common_shard, rare_shard…)
 *     consumables: [],
 *   }
 *
 * §C7 — Reads shards from the single canonical `inventories` store
 * (`items` map). Eggs removed in Phase 3 cleanup.
 */

import { getInventory } from "@/lib/modules/items/repository.server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) {
    return Response.json({ error: "wallet query param required" }, { status: 400 });
  }

  const inventory = await getInventory(wallet);

  // `items` map from the canonical inventory store: itemName → usable quantity.
  const itemsMap = (inventory?.items ?? {}) as Record<string, number>;

  // Shards: rarity-based quest rewards (common_shard, rare_shard, etc.)
  const shards = Object.entries(itemsMap)
    .filter(([type, amount]) => type.endsWith("_shard") && amount > 0)
    .map(([type, amount]) => ({ type, amount }));

  return Response.json({
    items:       [],
    shards,
    consumables: [],
  });
}

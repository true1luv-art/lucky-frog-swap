/**
 * POST /api/farm/inventory/buy
 *
 * Buys seeds by spending Wood and/or Stone from the player's inventory.
 * The resource cost per seed is read from SEEDS()[name].ingredients.
 *
 * Body: { items: Array<{ name: string; quantity: number }> }
 *   where `name` is a seed name (e.g. "Potato Seed").
 *
 * Response: { success: true, boughtItems: [...], resourcesSpent: Record<string, number> }
 *
 * Auth: Bearer token or rhf_token cookie.
 */

import { getWallet }              from "@/lib/api/get-wallet";
import { apiError, apiOk }        from "@/lib/api/error-response";
import { addItems, deductItems, getOrCreateInventory } from "@/lib/modules/items/repository.server";
import { SEEDS }                  from "@/features/types/gameplay/crops";

// ---------------------------------------------------------------------------
// Resource cost resolver — reads seed.ingredients for Wood/Stone quantities.
// ---------------------------------------------------------------------------

function getResourceCost(itemName: string): Record<string, number> {
  const seeds = SEEDS();
  const seed  = seeds[itemName as keyof typeof seeds];
  if (!seed?.ingredients?.length) return {};
  const costs: Record<string, number> = {};
  for (const ing of seed.ingredients) {
    costs[ing.item as string] = ing.amount.toNumber();
  }
  return costs;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  let body: { items?: Array<{ name: string; quantity: number }> };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_JSON", 400);
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return apiError("items array is required", "MISSING_ITEMS", 400);
  }

  // Validate and build buy list
  const buyList: Array<{
    name:          string;
    quantity:      number;
    unitCost:      Record<string, number>;
  }> = [];

  for (const entry of body.items) {
    if (!entry.name) return apiError("Each item must have a name", "INVALID_ITEM", 400);
    const quantity = Math.floor(entry.quantity ?? 0);
    if (quantity <= 0) return apiError(`Quantity for ${entry.name} must be > 0`, "INVALID_QUANTITY", 400);

    const unitCost = getResourceCost(entry.name);
    if (Object.keys(unitCost).length === 0) {
      return apiError(`${entry.name} is not a purchasable seed`, "NOT_PURCHASABLE", 422);
    }

    buyList.push({ name: entry.name, quantity, unitCost });
  }

  // Sum total resource cost across all requested seeds
  const totalCost: Record<string, number> = {};
  for (const { quantity, unitCost } of buyList) {
    for (const [resource, amount] of Object.entries(unitCost)) {
      totalCost[resource] = (totalCost[resource] ?? 0) + amount * quantity;
    }
  }

  // Check player has enough of each resource
  const inventory = await getOrCreateInventory(wallet);
  const items     = (inventory?.items ?? {}) as Record<string, number>;

  for (const [resource, required] of Object.entries(totalCost)) {
    const have = items[resource] ?? 0;
    if (have < required) {
      return apiError(
        `Not enough ${resource}. Need ${required}, have ${have}`,
        "INSUFFICIENT_RESOURCES",
        422,
      );
    }
  }

  // Deduct resources and add seeds atomically
  const addMap: Record<string, number> = {};
  for (const { name, quantity } of buyList) {
    addMap[name] = (addMap[name] ?? 0) + quantity;
  }

  await Promise.all([
    deductItems(wallet, totalCost),
    addItems(wallet, addMap),
  ]);

  return apiOk({
    boughtItems: buyList.map(({ name, quantity, unitCost }) => ({
      name, quantity, unitCost,
    })),
    resourcesSpent: totalCost,
  });
}

/**
 * POST /api/farm/inventory/buy
 *
 * Buys seeds for the player's farming inventory, deducting in-game balance (coins).
 * This mirrors the Phaser `item.crafted` buy flow (lib/events/craft/craft.ts) but runs
 * fully server-side so the client cannot forge buy prices.
 *
 * Body: { items: Array<{ name: string; quantity: number }> }
 *   where `name` is a seed name (e.g. "Potato Seed").
 *
 * The buy price for each seed is derived from CROPS_CONFIG in shared/data/farming.ts
 * and scaled by the current halving `emissionMultiplier`. See
 * docs/halving-price-integration.md §5 Step 3.
 *
 * Response: { success: true, boughtItems: ..., balanceSpent: number, newBalance: number }
 *
 * Auth: Bearer token or lfrg_token cookie.
 */

import { getWallet }            from "@/lib/api/get-wallet";
import { apiError, apiOk }      from "@/lib/api/error-response";
import { getOrCreateInventory, addItems, deductBalance } from "@/lib/modules/inventories/service.server";
import { getHalvingState }      from "@/lib/modules/game-stats/service.server";
import {
  CROPS_CONFIG,
  CropName,
  getHalvedPrice,
} from "@/shared/data/farming";

// ---------------------------------------------------------------------------
// Buy price resolver — seeds only, matches Phaser buy logic (getBuyPrice).
//
// Prices are halving-aware: the crop's base buyPrice is scaled by the current
// `emissionMultiplier` from the halving schedule. Only seeds (names ending in
// " Seed") are purchasable server-side; everything else returns 0.
// ---------------------------------------------------------------------------
function getBuyPrice(itemName: string, emissionMultiplier: number): number {
  if (!itemName.endsWith(" Seed")) return 0;

  const cropName = itemName.slice(0, -" Seed".length) as CropName;
  const cropEntry = CROPS_CONFIG[cropName];
  if (!cropEntry) return 0;

  return getHalvedPrice(cropEntry.buyPrice, emissionMultiplier);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  let body: { items?: Array<{ name: string; quantity: number }> };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_JSON", 400);
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return apiError("items array is required", "MISSING_ITEMS", 400);
  }

  // Resolve the current halving multiplier once per request (single MongoDB
  // read) so every item in this buy is priced against a consistent stage.
  // §5 Step 3 / §9 Edge Cases.
  const { emissionMultiplier } = await getHalvingState();

  // Validate buy prices and quantities
  const buyList = body.items.map((entry) => ({
    name:      entry.name,
    quantity:  Math.max(0, Math.floor(entry.quantity ?? 0)),
    unitPrice: getBuyPrice(entry.name, emissionMultiplier),
    subtotal:  0,
  }));

  for (const item of buyList) {
    if (!item.name) return apiError("Each item must have a name", "INVALID_ITEM", 400);
    if (item.quantity <= 0) return apiError(`Quantity for ${item.name} must be > 0`, "INVALID_QUANTITY", 400);
    if (item.unitPrice === 0) return apiError(`${item.name} is not purchasable`, "NOT_PURCHASABLE", 422);
    item.subtotal = item.unitPrice * item.quantity;
  }

  const totalCost = buyList.reduce((sum, i) => sum + i.subtotal, 0);

  // Verify the player can afford the purchase before mutating anything.
  const inventory = await getOrCreateInventory(wallet);
  if ((inventory.balance ?? 0) < totalCost) {
    return apiError("Insufficient balance", "INSUFFICIENT_BALANCE", 422);
  }

  // Build the add map (seed name → quantity)
  const addMap: Record<string, number> = {};
  for (const item of buyList) {
    addMap[item.name] = (addMap[item.name] ?? 0) + item.quantity;
  }

  // Atomically debit balance and credit items.
  await deductBalance(wallet, totalCost);
  await addItems(wallet, addMap);

  const updatedInventory = await getOrCreateInventory(wallet);

  return apiOk({
    boughtItems:  buyList.map(({ name, quantity, unitPrice, subtotal }) => ({ name, quantity, unitPrice, subtotal })),
    balanceSpent: totalCost,
    newBalance:   updatedInventory.balance,
  });
}

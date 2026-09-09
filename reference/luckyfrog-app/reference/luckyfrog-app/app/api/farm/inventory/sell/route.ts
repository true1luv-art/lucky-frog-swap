/**
 * POST /api/farm/inventory/sell
 *
 * Sells items from the player's farming inventory for in-game balance (coins). §2.2-A
 * This mirrors the Phaser `item.sell`, `food.sell`, `produce.sell` events but runs
 * fully server-side so the client cannot forge sell prices.
 *
 * Body: { items: Array<{ name: string; quantity: number }> }
 *
 * The sell price for each item is looked up from CROPS_CONFIG, FOODS_CONFIG, and
 * FISH_TABLE in shared/data/farming.ts. Unknown items (resources, etc.) use price 0.
 *
 * Response: { success: true, soldItems: ..., balanceAdded: number, newBalance: number }
 *
 * Auth: Bearer token or lfrg_token cookie.
 */

import { getWallet }            from "@/lib/api/get-wallet";
import { apiError, apiOk }      from "@/lib/api/error-response";
import { getOrCreateInventory, deductItems, addBalance } from "@/lib/modules/inventories/service.server";
import { FarmModel }             from "@/lib/modules/farms/model.server";
import { getHalvingState }       from "@/lib/modules/game-stats/service.server";
import {
  CROPS_CONFIG,
  FOODS_CONFIG,
  FISH_TABLE,
  getHalvedPrice,
} from "@/shared/data/farming";

// ---------------------------------------------------------------------------
// Sell price resolver — matches Phaser sell logic in events/sell.ts etc.
//
// Prices are halving-aware: the base price is scaled by the current
// `emissionMultiplier` from the halving schedule. See
// docs/halving-price-integration.md §5 Step 2.
// ---------------------------------------------------------------------------
function getSellPrice(itemName: string, emissionMultiplier: number): number {
  // Crops
  const cropEntry = Object.values(CROPS_CONFIG).find((c) => c.name === itemName);
  if (cropEntry) return getHalvedPrice(cropEntry.sellPrice, emissionMultiplier);

  // Food
  const foodEntry = FOODS_CONFIG[itemName as keyof typeof FOODS_CONFIG];
  if (foodEntry) return getHalvedPrice(foodEntry.sellPrice, emissionMultiplier);

  // Fish
  const fishEntry = FISH_TABLE.find((f) => f.name === itemName);
  if (fishEntry) return getHalvedPrice(fishEntry.sellPrice, emissionMultiplier);

  // Unknown / not sellable (resources, seeds etc. have no server sell price yet)
  return 0;
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
  // read) so every item in this sell is priced against a consistent stage.
  // §5 Step 2 / §9 Edge Cases.
  const { emissionMultiplier } = await getHalvingState();

  // Validate sell prices and quantities
  const sellList = body.items.map((entry) => ({
    name:       entry.name,
    quantity:   Math.max(0, Math.floor(entry.quantity ?? 0)),
    unitPrice:  getSellPrice(entry.name, emissionMultiplier),
    subtotal:   0,
  }));

  for (const item of sellList) {
    if (!item.name) return apiError("Each item must have a name", "INVALID_ITEM", 400);
    if (item.quantity <= 0) return apiError(`Quantity for ${item.name} must be > 0`, "INVALID_QUANTITY", 400);
    if (item.unitPrice === 0) return apiError(`${item.name} is not sellable`, "NOT_SELLABLE", 422);
    item.subtotal = item.unitPrice * item.quantity;
  }

  const totalEarned = sellList.reduce((sum, i) => sum + i.subtotal, 0);

  // Build deduction map
  const deductMap: Record<string, number> = {};
  for (const item of sellList) {
    deductMap[item.name] = (deductMap[item.name] ?? 0) + item.quantity;
  }

  // Verify holdings
  const inventory = await getOrCreateInventory(wallet);
  const currentItems = (inventory.items ?? {}) as Record<string, number>;
  for (const [name, qty] of Object.entries(deductMap)) {
    if ((currentItems[name] ?? 0) < qty) {
      return apiError(`Not enough ${name} in inventory`, "INSUFFICIENT_ITEMS", 422);
    }
  }

  // Atomically deduct items and credit balance
  await deductItems(wallet, deductMap);
  await addBalance(wallet, totalEarned);

  // §2.5-A — track "Coins Earned" activity on the farm document so economy
  // achievements ("First Sale", "Merchant", "Trader", …) have a server-side
  // source of truth that `checkAndGrantAchievements` can read.
  try {
    await FarmModel.findOneAndUpdate(
      { playerId: wallet },
      { $inc: { "activity.Coins Earned": totalEarned } },
      { upsert: false },   // only update if farm already exists
    );
  } catch {
    // Non-fatal: activity tracking failure must not block the sell response.
  }

  const updatedInventory = await getOrCreateInventory(wallet);

  return apiOk({
    soldItems:    sellList.map(({ name, quantity, unitPrice, subtotal }) => ({ name, quantity, unitPrice, subtotal })),
    balanceAdded: totalEarned,
    newBalance:   updatedInventory.balance,
  });
}

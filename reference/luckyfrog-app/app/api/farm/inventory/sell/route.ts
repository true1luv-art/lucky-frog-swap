/**
 * POST /api/farm/inventory/sell
 *
 * Sells items from the player's farming inventory for in-game coins.
 * The sell price for each item is looked up from SELL_PRICES config.
 * Unknown or non-sellable items (seeds, tools, armor) are rejected.
 *
 * Body: { items: Array<{ name: string; quantity: number }> }
 *
 * Response: { success: true, soldItems: [...], coinsEarned: number, newCoins: number }
 *
 * Auth: Bearer token or rhf_token cookie.
 */

import { getWallet }                           from "@/lib/api/get-wallet";
import { apiError, apiOk }                     from "@/lib/api/error-response";
import { hasItems, deductItems, setPlayerBalance, getPlayerForBalance } from "@/lib/modules/items/repository.server";
import { getSellPrice }                        from "@/features/game/sell-prices";

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

  // Resolve prices and validate entries
  const sellList: Array<{
    name:      string;
    quantity:  number;
    unitPrice: number;
    subtotal:  number;
  }> = [];

  for (const entry of body.items) {
    if (!entry.name) return apiError("Each item must have a name", "INVALID_ITEM", 400);
    const quantity = Math.floor(entry.quantity ?? 0);
    if (quantity <= 0) return apiError(`Quantity for ${entry.name} must be > 0`, "INVALID_QUANTITY", 400);

    const unitPrice = getSellPrice(entry.name);
    if (unitPrice === 0) return apiError(`${entry.name} is not sellable`, "NOT_SELLABLE", 422);

    sellList.push({ name: entry.name, quantity, unitPrice, subtotal: unitPrice * quantity });
  }

  const totalEarned = sellList.reduce((sum, i) => sum + i.subtotal, 0);

  // Build deduction map
  const deductMap: Record<string, number> = {};
  for (const item of sellList) {
    deductMap[item.name] = (deductMap[item.name] ?? 0) + item.quantity;
  }

  // Verify holdings
  const canSell = await hasItems(wallet, deductMap);
  if (!canSell) {
    return apiError("Not enough items in inventory", "INSUFFICIENT_ITEMS", 422);
  }

  // Fetch current coins, deduct items, and credit coins atomically
  const playerBalance = await getPlayerForBalance(wallet);
  const currentCoins  = playerBalance?.coins ?? 0;
  const newCoins      = currentCoins + totalEarned;

  await Promise.all([
    deductItems(wallet, deductMap),
    setPlayerBalance(wallet, newCoins),
  ]);

  return apiOk({
    soldItems:   sellList,
    coinsEarned: totalEarned,
    newCoins,
  });
}

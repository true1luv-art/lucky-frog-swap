import Decimal from "decimal.js-light";
import { GameState, InventoryItemName } from "@/features/types/gameplay/game";
import { getSellPrice } from "@/features/game/sell-prices";

export type SellFoodAction = { type: "food.sell"; item: InventoryItemName; amount: number };

/**
 * Optimistic client-side sell for cooked food.
 * Deducts items from inventory and credits coins to state.coins.
 * The server route POST /api/farm/inventory/sell is authoritative.
 */
export function sellFood({ state, action }: { state: GameState; action: SellFoodAction }): GameState {
  if (action.amount <= 0) throw new Error("Invalid amount");

  const unitPrice = getSellPrice(action.item as string);
  if (unitPrice === 0) throw new Error(`${action.item} is not sellable`);

  const current = new Decimal((state.items as Record<string, Decimal>)[action.item] ?? 0);
  if (current.lt(action.amount)) throw new Error(`Not enough ${action.item}`);

  const earned    = new Decimal(unitPrice * action.amount);
  const nextItems = { ...state.items, [action.item]: current.sub(action.amount) };

  return {
    ...state,
        items: nextItems,
    coins: (state.coins ?? new Decimal(0)).add(earned),
  };
}

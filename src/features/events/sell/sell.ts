import Decimal from "decimal.js-light";
import { GameState, InventoryItemName } from "@/features/types/gameplay/game";
import { getSellPrice } from "@/features/game/sell-prices";

export type SellAction = { type: "item.sell"; item: InventoryItemName; amount: number };

/**
 * Optimistic client-side sell for crops.
 * Deducts crop from inventory and credits coins.
 * The server route POST /api/farm/inventory/sell is authoritative.
 */
export function sell({ state, action }: { state: GameState; action: SellAction }): GameState {
  if (action.amount <= 0 || !Number.isInteger(action.amount)) throw new Error("Invalid amount");

  const unitPrice = getSellPrice(action.item as string);
  if (unitPrice === 0) throw new Error("Not for sale");

  const current = new Decimal((state.items as Record<string, Decimal>)[action.item] ?? 0);
  if (current.lt(action.amount)) throw new Error("Insufficient crops to sell");

  const earned    = new Decimal(unitPrice * action.amount);
  const nextItems = { ...state.items, [action.item]: current.sub(action.amount) };

  return {
    ...state,
        items: nextItems,
    coins: (state.coins ?? new Decimal(0)).add(earned),
  };
}

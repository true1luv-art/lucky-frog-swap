import Decimal from "decimal.js-light";
import { CropName, CROPS } from "@/shared/types/gameplay/crops";
import { GameState, InventoryItemName } from "@/shared/types/gameplay/game";
import { getSellPrice } from "@/shared/game/boosts";
import { trackActivity } from "@/shared/game/activity";

export type SellAction = { type: "item.sell"; item: InventoryItemName; amount: number };

function isCrop(item: InventoryItemName): item is CropName {
  return item in CROPS();
}

type Options = { state: GameState; action: SellAction };

export function sell({ state, action }: Options): GameState {
  if (!isCrop(action.item)) throw new Error("Not for sale");
  if (action.amount <= 0)   throw new Error("Invalid amount");

  const crop      = CROPS()[action.item];
  const cropCount = new Decimal(state.inventory[action.item] || 0);
  if (cropCount.lessThan(action.amount)) throw new Error("Insufficient crops to sell");

  const price       = getSellPrice(crop, state.inventory);
  const totalEarned = price.mul(action.amount).toNumber();

  return {
    ...state,
    balance:   new Decimal(state.balance).add(price.mul(action.amount)),
    inventory: { ...state.inventory, [crop.name]: cropCount.minus(action.amount) },
    activity:  trackActivity(state.activity, "Coins Earned", totalEarned),
  };
}

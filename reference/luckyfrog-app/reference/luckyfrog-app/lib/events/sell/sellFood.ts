import Decimal from "decimal.js-light";
import { Food, FOODS } from "@/shared/types/gameplay/craftables";
import { GameState, InventoryItemName } from "@/shared/types/gameplay/game";

export type SellFoodAction = { type: "food.sell"; item: InventoryItemName; amount: number };

function isFood(item: InventoryItemName): item is Food {
  return item in FOODS();
}

type Options = { state: GameState; action: SellFoodAction };

export function sellFood({ state, action }: Options): GameState {
  if (!isFood(action.item))  throw new Error("Not a food item");
  if (action.amount <= 0)    throw new Error("Invalid amount");

  const food = FOODS()[action.item];
  if (!food.sellPrice)       throw new Error("Food has no sell price");

  const foodCount = state.inventory[action.item] || new Decimal(0);
  const countDec  = foodCount instanceof Decimal ? foodCount : new Decimal(foodCount);
  if (countDec.lessThan(action.amount)) throw new Error("Insufficient food to sell");

  return {
    ...state,
    balance:   new Decimal(state.balance).add(food.sellPrice.mul(action.amount)),
    inventory: { ...state.inventory, [food.name]: countDec.sub(action.amount) },
  };
}

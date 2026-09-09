import Decimal from "decimal.js-light";
import { Food, FOODS, FOOD_EFFECTS } from "@/features/types/gameplay/craftables";
import { GameState, InventoryItemName } from "@/features/types/gameplay/game";
import { INITIAL_HP } from "@/features/game/hp";

export type ConsumeFoodAction = {
  type: "food.consume";
  item: InventoryItemName;
  amount: number;
};

function isFood(item: InventoryItemName): item is Food {
  return item in FOODS();
}

type Options = { state: GameState; action: ConsumeFoodAction };

/**
 * consumeFood — eat cooked food from the inventory.
 *
 * Removes food from inventory and restores HP according to FOOD_EFFECTS.
 */
export function consumeFood({ state, action }: Options): GameState {
  if (!isFood(action.item)) throw new Error("Not a food item");
  if (action.amount <= 0)   throw new Error("Invalid amount");

  const foodCount = state.items[action.item] || new Decimal(0);
  const countDec  = foodCount instanceof Decimal ? foodCount : new Decimal(foodCount);
  if (countDec.lessThan(action.amount)) throw new Error("Insufficient food to eat");

  const effects        = FOOD_EFFECTS[action.item as Food];
  const currentHp = state.hp ?? INITIAL_HP;
  const newHp     = Math.min(INITIAL_HP, currentHp + (effects?.hp ?? 0) * action.amount);

  const nextItems = { ...state.items, [action.item]: countDec.sub(action.amount) };
  return {
    ...state,
        items: nextItems,
    hp: newHp,
  };
}

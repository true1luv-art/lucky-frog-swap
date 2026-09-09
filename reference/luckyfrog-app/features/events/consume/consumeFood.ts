import Decimal from "decimal.js-light";
import { Food, FOODS, FOOD_EFFECTS } from "@/features/types/gameplay/craftables";
import { GameState, InventoryItemName } from "@/features/types/gameplay/game";
import { STAMINA_CONSTANTS } from "@/features/game/stamina";

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
 * Removes food from inventory and restores stamina according to FOOD_EFFECTS.
 * Stamina is clamped to DEFAULT_MAX_STAMINA (100).
 */
export function consumeFood({ state, action }: Options): GameState {
  if (!isFood(action.item)) throw new Error("Not a food item");
  if (action.amount <= 0)   throw new Error("Invalid amount");

  const foodCount = state.items[action.item] || new Decimal(0);
  const countDec  = foodCount instanceof Decimal ? foodCount : new Decimal(foodCount);
  if (countDec.lessThan(action.amount)) throw new Error("Insufficient food to eat");

  const effects        = FOOD_EFFECTS[action.item as Food];
  const currentStamina = state.stamina ?? 0;
  const maxStamina     = STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;
  const newStamina     = Math.min(maxStamina, currentStamina + (effects?.stamina ?? 0) * action.amount);

  const nextItems = { ...state.items, [action.item]: countDec.sub(action.amount) };
  return {
    ...state,
        items: nextItems,
    stamina:   newStamina,
  };
}

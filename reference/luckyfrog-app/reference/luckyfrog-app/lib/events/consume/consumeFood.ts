import Decimal from "decimal.js-light";
import { Food, FOODS, FOOD_STAMINA_RESTORE } from "@/shared/types/gameplay/craftables";
import { GameState, InventoryItemName } from "@/shared/types/gameplay/game";
import { STAMINA_CONSTANTS } from "@/shared/game/stamina";

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
 * consumeFood — eat cooked food from the inventory to restore stamina.
 *
 * Each unit restores `FOOD_STAMINA_RESTORE[item]` stamina, capped at the
 * player's max. The food is removed from the inventory. Mirrors the pure,
 * throw-on-invalid style of sellFood so it works both as the client-side
 * optimistic reducer and via the server's processGameEvent default path.
 */
export function consumeFood({ state, action }: Options): GameState {
  if (!isFood(action.item)) throw new Error("Not a food item");
  if (action.amount <= 0)   throw new Error("Invalid amount");

  const foodCount = state.inventory[action.item] || new Decimal(0);
  const countDec  = foodCount instanceof Decimal ? foodCount : new Decimal(foodCount);
  if (countDec.lessThan(action.amount)) throw new Error("Insufficient food to eat");

  const maxStamina = state.stamina.max ?? STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;
  if (state.stamina.current >= maxStamina) throw new Error("Stamina is already full");

  const restorePerUnit = FOOD_STAMINA_RESTORE[action.item];
  const totalRestore   = restorePerUnit * action.amount;
  const newStamina     = Math.min(state.stamina.current + totalRestore, maxStamina);

  return {
    ...state,
    stamina:   { current: newStamina, max: maxStamina },
    inventory: { ...state.inventory, [action.item]: countDec.sub(action.amount) },
  };
}

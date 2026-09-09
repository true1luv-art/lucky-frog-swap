import Decimal from "decimal.js-light";
import { Food, FOODS } from "@/shared/types/gameplay/craftables";
import { GameState } from "@/shared/types/gameplay/game";
import { getCookXP, getSkillLevel } from "@/shared/game/skills";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { getRoundedReducedDuration } from "@/shared/game/boosts";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";

export type StartCookingAction = { type: "food.startCooking"; item: Food };
type Options = { state: GameState; action: StartCookingAction; createdAt?: number };

export enum START_COOKING_ERRORS {
  KITCHEN_BUSY           = "Kitchen is already busy",
  UNKNOWN_FOOD           = "Unknown food item",
  NOT_ENOUGH_INGREDIENTS = "Not enough ingredients",
}

export function startCooking({ state, action, createdAt = Date.now() }: Options): GameState {
  if (state.cooking !== null) throw new Error(START_COOKING_ERRORS.KITCHEN_BUSY);

  const recipe = FOODS()[action.item];
  if (!recipe) throw new Error(START_COOKING_ERRORS.UNKNOWN_FOOD);

  const subtractedInventory = recipe.ingredients.reduce(
    (inventory, ingredient) => {
      const have = new Decimal(inventory[ingredient.item] ?? 0);
      const need = ingredient.amount instanceof Decimal ? ingredient.amount : new Decimal(ingredient.amount);
      if (have.lessThan(need)) throw new Error(`${START_COOKING_ERRORS.NOT_ENOUGH_INGREDIENTS}: ${ingredient.item}`);
      return { ...inventory, [ingredient.item]: have.sub(need) };
    },
    state.inventory,
  );

  const effectiveDuration = getRoundedReducedDuration(
    recipe.cookTime ?? 60,
    state.bonus?.cookingSpeed ?? 0,
  );

  const cookXP       = getCookXP(action.item);
  const newCookingXP = (state.skills.cooking ?? 0) + cookXP;
  const oldLevel     = getSkillLevel(state.skills.cooking ?? 0);
  const newLevel     = getSkillLevel(newCookingXP);
  const newBonus     = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(
        { ...state.skills, cooking: newCookingXP },
        state.ownedCollectibles,
      )
    : (state.bonus ?? { ...INITIAL_BONUS });

  return {
    ...state,
    inventory: subtractedInventory,
    cooking:   { item: action.item, startedAt: createdAt, duration: effectiveDuration },
    skills:    { ...state.skills, cooking: newCookingXP },
    bonus:     newBonus,
  };
}

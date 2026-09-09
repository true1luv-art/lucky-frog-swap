import Decimal from "decimal.js-light";
import type { Food } from "@/features/types/gameplay/craftables";
import { FOODS, FOOD_FARM_LEVEL_REQUIREMENT } from "@/features/types/gameplay/craftables";
import type { GameState } from "@/features/types/gameplay/game";
import { trackMilestone } from "@/features/game/milestones";
import type { MilestoneName } from "@/features/types/gameplay/milestones";
import { getCookXP } from "@/features/game/skills";

export type CookFoodAction = {
  type: "food.cook";
  food: Food;
  /** How many portions to cook in one action (default 1). */
  amount?: number;
};

/**
 * Instant cook — deducts ingredients + 1x Wood fuel per portion, then adds
 * the food to inventory immediately. Grants cooking XP.
 *
 * The 1 Wood fuel is not listed in FOODS() ingredients — it is always
 * appended here so the recipe display stays clean.
 */
export function cookFood(state: GameState, action: CookFoodAction): GameState {
  const { food, amount = 1 } = action;
  const recipe = FOODS()[food];

  if (!recipe) {
    throw new Error(`Unknown food: ${food}`);
  }
  if (amount < 1 || !Number.isInteger(amount)) {
    throw new Error("Amount must be a positive integer.");
  }

  // Guard: recipe requires sufficient farm level
  const farmLevel     = state.farmLevel ?? 1;
  const requiredLevel = FOOD_FARM_LEVEL_REQUIREMENT[food as Food] ?? 1;
  if (farmLevel < requiredLevel) {
    throw new Error(`Recipe "${food}" requires Farm Level ${requiredLevel}.`);
  }

  let nextItems = { ...state.items };

  // Deduct food-specific ingredients
  for (const { item, amount: needed } of recipe.ingredients) {
    const have  = nextItems[item] ?? new Decimal(0);
    const total = needed.mul(amount);
    if (have.lessThan(total)) {
      throw new Error(`Not enough ${item}. Need ${total}, have ${have}.`);
    }
    nextItems[item] = have.minus(total);
  }

  // Deduct 1x Wood per portion as fuel
  const woodHave = nextItems["Wood"] ?? new Decimal(0);
  const woodCost = new Decimal(amount);
  if (woodHave.lessThan(woodCost)) {
    throw new Error(`Not enough Wood fuel. Need ${woodCost}, have ${woodHave}.`);
  }
  nextItems["Wood"] = woodHave.minus(woodCost);

  // Add the cooked food
  const currentFood = nextItems[food] ?? new Decimal(0);
  nextItems[food] = currentFood.plus(amount);

  let milestones = trackMilestone(state.milestones, "Food Cooked", amount);
  milestones = trackMilestone(milestones, `${food} Cooked` as MilestoneName, amount);

  const cookingXP = (state.skills.cooking ?? 0) + getCookXP(food) * amount;

  return {
    ...state,
        items: nextItems, // alias
    skills: { ...state.skills, cooking: cookingXP },
    milestones,
  };
}

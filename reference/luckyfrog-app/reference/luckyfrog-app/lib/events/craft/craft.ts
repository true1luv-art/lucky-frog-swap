import Decimal from "decimal.js-light";
import { ANIMALS, CraftableName, CRAFTABLES, FOODS } from "@/shared/types/gameplay/craftables";
import { SEEDS } from "@/shared/types/gameplay/crops";
import { GameState, InventoryItemName } from "@/shared/types/gameplay/game";
import { getCookXP, getSkillLevel } from "@/shared/game/skills";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

export type CraftAction = { type: "item.crafted"; item: CraftableName; amount: number };

/**
 * Returns the effective buy price of a craftable, optionally reduced by
 * inventory boosts. For now returns the base price directly.
 */
export function getBuyPrice(item: { price?: Decimal }, _inventory: unknown): Decimal {
  return item.price ?? new Decimal(0);
}

const VALID_ITEMS = Object.keys({ ...SEEDS(), ...FOODS(), ...ANIMALS }) as CraftableName[];

type Options = { state: GameState; action: CraftAction; available?: CraftableName[] };

export function craft({ state, action, available }: Options): GameState {
  const validItems = available || VALID_ITEMS;
  if (!validItems.includes(action.item)) throw new Error(`This item is not craftable: ${action.item}`);

  const item = CRAFTABLES()[action.item];
  if (item.disabled)    throw new Error("This item is disabled");
  if (action.amount < 1) throw new Error("Invalid amount");

  const price         = item.price || new Decimal(0);
  const totalExpenses = price.mul(action.amount);

  if (new Decimal(state.balance).lessThan(totalExpenses)) throw new Error("Insufficient tokens");

  const subtractedInventory = item.ingredients.reduce(
    (inventory, ingredient) => {
      const count       = new Decimal(inventory[ingredient.item] || 0);
      const totalAmount = ingredient.amount.mul(action.amount);
      if (count.lessThan(totalAmount)) throw new Error(`Insufficient ingredient: ${ingredient.item}`);
      return { ...inventory, [ingredient.item]: count.sub(totalAmount) };
    },
    state.inventory,
  );

  const oldAmount    = new Decimal(state.inventory[action.item] || 0);
  const cookingXP    = getCookXP(action.item) * action.amount;
  const newCookingXP = (state.skills.cooking ?? 0) + cookingXP;

  const oldLevel = getSkillLevel(state.skills.cooking ?? 0);
  const newLevel = getSkillLevel(newCookingXP);
  const newBonus = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(
        { ...state.skills, cooking: newCookingXP },
        state.ownedCollectibles,
      )
    : (state.bonus ?? { ...INITIAL_BONUS });

  return {
    ...state,
    balance:   new Decimal(state.balance).sub(totalExpenses),
    inventory: { ...subtractedInventory, [action.item]: oldAmount.add(action.amount) },
    skills:    { ...state.skills, cooking: newCookingXP },
    bonus:     newBonus,
  };
}

import Decimal from "decimal.js-light";
import { ANIMALS, Animal, CraftableName, CRAFTABLES, FOODS } from "@/features/types/gameplay/craftables";
import { SEEDS } from "@/features/types/gameplay/crops";
import { GameState } from "@/features/types/gameplay/game";

export type PurchaseAction = { type: "item.crafted"; item: CraftableName; amount: number };

const VALID_ITEMS = Object.keys({ ...SEEDS(), ...FOODS(), ...ANIMALS }) as CraftableName[];
const ANIMAL_NAMES = Object.keys(ANIMALS) as Animal[];

type Options = { state: GameState; action: PurchaseAction; available?: CraftableName[] };

/**
 * Handles shop-purchase of seeds, foods, and animals.
 *
 * Seeds/foods: deduct resource ingredients (Wood/Stone) — no coin cost.
 * Animals: deduct coins from state.coins (price field = coin units).
 */
export function purchase({ state, action, available }: Options): GameState {
  const validItems = available || VALID_ITEMS;
  if (!validItems.includes(action.item)) throw new Error(`This item is not purchasable: ${action.item}`);

  const item = CRAFTABLES()[action.item];
  if (item.disabled)     throw new Error("This item is disabled");
  if (action.amount < 1) throw new Error("Invalid amount");

  let inv = { ...state.items };

  // Animals cost coins (state.coins — typed as Decimal)
  const isAnimal  = ANIMAL_NAMES.includes(action.item as Animal);
  const coinCost  = isAnimal
    ? (item.price ?? new Decimal(0)).mul(action.amount)
    : new Decimal(0);
  const coinHave  = new Decimal(state.coins ?? 0);

  if (isAnimal && coinHave.lt(coinCost)) {
    throw new Error(`Not enough coins (need ${coinCost.toNumber()}, have ${coinHave.toNumber()})`);
  }

  // Deduct resource ingredients (seeds, etc.)
  inv = item.ingredients.reduce(
    (inventory, ingredient) => {
      const count      = new Decimal((inventory as Record<string, Decimal>)[ingredient.item] ?? 0);
      const totalAmount = ingredient.amount.mul(action.amount);
      if (count.lessThan(totalAmount)) throw new Error(`Insufficient ingredient: ${ingredient.item}`);
      return { ...inventory, [ingredient.item]: count.sub(totalAmount) };
    },
    inv,
  );

  const oldAmount = new Decimal((inv as Record<string, Decimal>)[action.item] ?? 0);

  const nextBag = { ...inv, [action.item]: oldAmount.add(action.amount) };

  return {
    ...state,
    coins: isAnimal ? coinHave.sub(coinCost) : coinHave,
    items: nextBag,
  };
}

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { cookFood } from "./cookFood";
import { FOODS } from "@/features/types/gameplay/craftables";
import type { GameState } from "@/features/types/gameplay/game";

/** Build a state pre-loaded with all ingredients for a given food. */
function makeStateWithIngredients(food: keyof ReturnType<typeof FOODS>, amount = 1): GameState {
  const recipe = FOODS()[food];
  const items: Record<string, Decimal> = {};
  for (const { item, amount: needed } of recipe.ingredients) {
    items[item as string] = needed.mul(amount).plus(5);
  }
  return {
    balance:   new Decimal(0),
    items,
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      {},
    sheep:     {},
    fishing:   { lastCastAt: 0, lastCaughtFish: null },
    cooking:   null,
    stamina:   { current: 50, max: 100 },
    lastStaminaRegenAt: 0,
    skills:    { farming: 0, woodcutting: 0, forestry: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
    milestones: {},
  } as unknown as GameState;
}

const FIRST_FOOD = Object.keys(FOODS())[0] as keyof ReturnType<typeof FOODS>;

describe("cookFood", () => {
  it("deducts ingredients and adds cooked food to inventory", () => {
    const state  = makeStateWithIngredients(FIRST_FOOD);
    const before = new Decimal(state.items[FIRST_FOOD] ?? 0).toNumber();
    const result = cookFood(state, { type: "food.cook", food: FIRST_FOOD, amount: 1 });
    expect(new Decimal(result.items[FIRST_FOOD]!).toNumber()).toBe(before + 1);
  });

  it("cooks multiple portions in one action", () => {
    const state  = makeStateWithIngredients(FIRST_FOOD, 3);
    const result = cookFood(state, { type: "food.cook", food: FIRST_FOOD, amount: 3 });
    expect(new Decimal(result.items[FIRST_FOOD]!).toNumber()).toBeGreaterThanOrEqual(3);
  });

  it("throws for an unknown food name", () => {
    const state = makeStateWithIngredients(FIRST_FOOD);
    expect(() =>
      cookFood(state, { type: "food.cook", food: "Not A Food" as never }),
    ).toThrow("Unknown food");
  });

  it("throws when amount is zero", () => {
    const state = makeStateWithIngredients(FIRST_FOOD);
    expect(() =>
      cookFood(state, { type: "food.cook", food: FIRST_FOOD, amount: 0 }),
    ).toThrow("Amount must be a positive integer");
  });

  it("throws when ingredients are insufficient", () => {
    const state: GameState = {
      balance: new Decimal(0),
      items: {},
      fields: {}, trees: {}, stones: {}, iron: {}, gold: {},
      chickens: {}, cows: {}, sheep: {},
      fishing: { lastCastAt: 0, lastCaughtFish: null },
      cooking: null,
      stamina: { current: 50, max: 100 },
      lastStaminaRegenAt: 0,
      skills: { farming: 0, woodcutting: 0, forestry: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
      milestones: {},
    } as unknown as GameState;
    expect(() =>
      cookFood(state, { type: "food.cook", food: FIRST_FOOD, amount: 1 }),
    ).toThrow("Not enough");
  });

  it("tracks Food Cooked milestone", () => {
    const state  = makeStateWithIngredients(FIRST_FOOD);
    const result = cookFood(state, { type: "food.cook", food: FIRST_FOOD, amount: 1 });
    expect(result.milestones["Food Cooked"]).toBeGreaterThanOrEqual(1);
  });
});

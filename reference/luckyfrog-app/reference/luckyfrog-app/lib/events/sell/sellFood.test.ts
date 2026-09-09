import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { sellFood } from "./sellFood";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

// "Roasted Potato" is a food with a sellPrice in FOODS()
const FOOD_WITH_SELL_PRICE = "Roasted Potato";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(100),
    inventory: { [FOOD_WITH_SELL_PRICE]: new Decimal(3) },
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      {},
    sheep:     {},
    fishing:   { lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
    cooking:   null,
    stamina:   { current: 100, max: 100 },
    lastStaminaRegenAt: 0,
    skills:    { farming: 0, woodcutting: 0, forestry: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
    bonus:     { ...INITIAL_BONUS },
    activity:  {},
    achievements: {},
    ...overrides,
  } as unknown as GameState;
}

describe("sellFood", () => {
  it("throws when item is not a food", () => {
    const state = makeState();
    expect(() => sellFood({ state, action: { type: "food.sell", item: "Potato", amount: 1 } })).toThrow("Not a food item");
  });

  it("throws when amount is zero or negative", () => {
    const state = makeState();
    expect(() => sellFood({ state, action: { type: "food.sell", item: FOOD_WITH_SELL_PRICE, amount: 0 } })).toThrow("Invalid amount");
    expect(() => sellFood({ state, action: { type: "food.sell", item: FOOD_WITH_SELL_PRICE, amount: -2 } })).toThrow("Invalid amount");
  });

  it("throws when insufficient food in inventory", () => {
    const state = makeState({ inventory: { [FOOD_WITH_SELL_PRICE]: new Decimal(1) } });
    expect(() => sellFood({ state, action: { type: "food.sell", item: FOOD_WITH_SELL_PRICE, amount: 5 } })).toThrow("Insufficient food to sell");
  });

  it("increases balance and decreases inventory on successful sell", () => {
    const state  = makeState();
    const result = sellFood({ state, action: { type: "food.sell", item: FOOD_WITH_SELL_PRICE, amount: 2 } });
    expect(new Decimal(result.balance).greaterThan(state.balance)).toBe(true);
    expect(new Decimal(result.inventory[FOOD_WITH_SELL_PRICE]!).toNumber()).toBe(1);
  });
});

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { sellProduce } from "./sellProduce";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(100),
    inventory: { Egg: new Decimal(5), Milk: new Decimal(3), Wool: new Decimal(2) },
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

describe("sellProduce", () => {
  it("throws when item is not a produce", () => {
    const state = makeState();
    expect(() => sellProduce({ state, action: { type: "produce.sell", item: "Potato", amount: 1 } })).toThrow("Not a produce item");
  });

  it("throws when amount is zero or negative", () => {
    const state = makeState();
    expect(() => sellProduce({ state, action: { type: "produce.sell", item: "Egg", amount: 0 } })).toThrow("Invalid amount");
    expect(() => sellProduce({ state, action: { type: "produce.sell", item: "Egg", amount: -1 } })).toThrow("Invalid amount");
  });

  it("throws when insufficient produce", () => {
    const state = makeState({ inventory: { Egg: new Decimal(1) } });
    expect(() => sellProduce({ state, action: { type: "produce.sell", item: "Egg", amount: 5 } })).toThrow("Insufficient produce to sell");
  });

  it("increases balance and deducts inventory for Egg", () => {
    const state  = makeState();
    const result = sellProduce({ state, action: { type: "produce.sell", item: "Egg", amount: 2 } });
    expect(new Decimal(result.balance).greaterThan(state.balance)).toBe(true);
    expect(new Decimal(result.inventory["Egg"]!).toNumber()).toBe(3);
  });

  it("increases balance and deducts inventory for Milk", () => {
    const state  = makeState();
    const result = sellProduce({ state, action: { type: "produce.sell", item: "Milk", amount: 1 } });
    expect(new Decimal(result.inventory["Milk"]!).toNumber()).toBe(2);
  });

  it("increases balance and deducts inventory for Wool", () => {
    const state  = makeState();
    const result = sellProduce({ state, action: { type: "produce.sell", item: "Wool", amount: 1 } });
    expect(new Decimal(result.inventory["Wool"]!).toNumber()).toBe(1);
  });

  it("tracks Coins Earned activity", () => {
    const state  = makeState();
    const result = sellProduce({ state, action: { type: "produce.sell", item: "Egg", amount: 1 } });
    expect(result.activity["Coins Earned"]).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { sellFood, isFood } from "./sellFood";
import type { GameState } from "@/features/types/gameplay/game";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(100),
    items: { "Roasted Potato": new Decimal(3) },
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
    stamina:   { current: 100, max: 100 },
    lastStaminaRegenAt: 0,
    skills:    { farming: 0, woodcutting: 0, forestry: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
    milestones: {},
    ...overrides,
  } as unknown as GameState;
}

describe("sellFood", () => {
  it("isFood correctly identifies food items", () => {
    expect(isFood("Roasted Potato")).toBe(true);
    expect(isFood("Kale Stir-fry")).toBe(true);
    expect(isFood("Potato")).toBe(false);
    expect(isFood("Stone")).toBe(false);
  });

  it("throws with marketplace redirect message (coin selling removed)", () => {
    const state = makeState();
    expect(() =>
      sellFood({ state, action: { type: "food.sell", item: "Roasted Potato", amount: 1 } }),
    ).toThrow("marketplace");
  });
});

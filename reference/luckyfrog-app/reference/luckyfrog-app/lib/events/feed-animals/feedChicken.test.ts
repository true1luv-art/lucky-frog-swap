import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { feedChicken } from "./feedChicken";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { CHICKEN_TIME_TO_EGG, CHICKEN_RE_HUNGER_DELAY } from "@/shared/game/constants";

const NOW = 1_000_000;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    inventory: { Chicken: new Decimal(2), Wheat: new Decimal(5) },
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  { 0: { fedAt: undefined, multiplier: 1 }, 1: { fedAt: undefined, multiplier: 1 } },
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

describe("feedChicken", () => {
  it("throws when chicken index is out of bounds", () => {
    const state = makeState();
    expect(() => feedChicken({ state, action: { type: "chicken.feed", index: 5 }, createdAt: NOW })).toThrow("Chicken does not exist");
    expect(() => feedChicken({ state, action: { type: "chicken.feed", index: -1 }, createdAt: NOW })).toThrow("Chicken does not exist");
  });

  it("throws when chicken has already been fed and is not re-hungry", () => {
    const state = makeState({ chickens: { 0: { fedAt: NOW, multiplier: 1 } } });
    expect(() => feedChicken({ state, action: { type: "chicken.feed", index: 0 }, createdAt: NOW + 1 })).toThrow("Chicken is not hungry");
  });

  it("throws when not enough Wheat", () => {
    const state = makeState({ inventory: { Chicken: new Decimal(2), Wheat: new Decimal(0) } });
    expect(() => feedChicken({ state, action: { type: "chicken.feed", index: 0 }, createdAt: NOW })).toThrow("Not enough Wheat to feed chicken");
  });

  it("feeds a hungry (unfed) chicken and deducts Wheat", () => {
    const state  = makeState();
    const result = feedChicken({ state, action: { type: "chicken.feed", index: 0 }, createdAt: NOW });
    expect(result.chickens[0].fedAt).toBe(NOW);
    expect(new Decimal(result.inventory["Wheat"]!).toNumber()).toBe(4);
  });

  it("allows re-feeding a re-hungry chicken", () => {
    const rehungryAt = NOW - (CHICKEN_TIME_TO_EGG + CHICKEN_RE_HUNGER_DELAY) - 1;
    const state      = makeState({ chickens: { 0: { fedAt: rehungryAt, multiplier: 1 } } });
    const result     = feedChicken({ state, action: { type: "chicken.feed", index: 0 }, createdAt: NOW });
    expect(result.chickens[0].fedAt).toBe(NOW);
  });

  it("tracks Animal Fed activity", () => {
    const state  = makeState();
    const result = feedChicken({ state, action: { type: "chicken.feed", index: 0 }, createdAt: NOW });
    expect(result.activity["Animal Fed"]).toBe(1);
  });
});

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { feedChicken } from "./feedChicken";
import type { GameState } from "@/features/types/gameplay/game";
import { ANIMALS_CONFIG } from "@/features/game/animals";

const NOW = 1_000_000;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    items: { Chicken: new Decimal(2), Carrot: new Decimal(5) },
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  { 0: { fedAt: undefined, multiplier: 1 }, 1: { fedAt: undefined, multiplier: 1 } },
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

  it("throws when not enough Carrot", () => {
    const state = makeState({ items: { Chicken: new Decimal(2), Carrot: new Decimal(0) } });
    expect(() => feedChicken({ state, action: { type: "chicken.feed", index: 0 }, createdAt: NOW })).toThrow("Not enough Carrot to feed chicken");
  });

  it("feeds a hungry (unfed) chicken and deducts Carrot", () => {
    const state  = makeState();
    const result = feedChicken({ state, action: { type: "chicken.feed", index: 0 }, createdAt: NOW });
    expect(result.chickens[0].fedAt).toBe(NOW);
    expect(new Decimal(result.items["Carrot"]!).toNumber()).toBe(4);
  });

  it("allows re-feeding a re-hungry chicken", () => {
    const rehungryAt = NOW - (ANIMALS_CONFIG.Chicken.produceTimeMs + ANIMALS_CONFIG.Chicken.reHungerDelayMs) - 1;
    const state      = makeState({ chickens: { 0: { fedAt: rehungryAt, multiplier: 1 } } });
    const result     = feedChicken({ state, action: { type: "chicken.feed", index: 0 }, createdAt: NOW });
    expect(result.chickens[0].fedAt).toBe(NOW);
  });

  it("tracks Animal Fed activity", () => {
    const state  = makeState();
    const result = feedChicken({ state, action: { type: "chicken.feed", index: 0 }, createdAt: NOW });
    expect(result.milestones["Animal Fed"]).toBe(1);
  });
});

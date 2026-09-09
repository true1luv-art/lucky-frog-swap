import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { feedCow } from "./feedCow";
import type { GameState } from "@/features/types/gameplay/game";
import { ANIMALS_CONFIG } from "@/features/game/animals";

const NOW = 1_000_000;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    items: { Cow: new Decimal(2), Beetroot: new Decimal(5) },
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      { 0: { fedAt: undefined, multiplier: 1 }, 1: { fedAt: undefined, multiplier: 1 } },
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

describe("feedCow", () => {
  it("throws when cow is already fed and not re-hungry", () => {
    const state = makeState({ cows: { 0: { fedAt: NOW, multiplier: 1 } } });
    expect(() => feedCow({ state, action: { type: "cow.feed", index: 0 }, createdAt: NOW + 1 })).toThrow("Cow is not hungry");
  });

  it("throws when not enough Beetroot", () => {
    const state = makeState({ items: { Cow: new Decimal(2), Beetroot: new Decimal(0) } });
    expect(() => feedCow({ state, action: { type: "cow.feed", index: 0 }, createdAt: NOW })).toThrow("Not enough Beetroot to feed cow");
  });

  it("feeds an unfed cow and deducts 2x Beetroot", () => {
    const state  = makeState();
    const result = feedCow({ state, action: { type: "cow.feed", index: 0 }, createdAt: NOW });
    expect(result.cows[0].fedAt).toBe(NOW);
    expect(new Decimal(result.items["Beetroot"]!).toNumber()).toBe(3);
  });

  it("allows re-feeding a re-hungry cow", () => {
    const rehungryAt = NOW - (ANIMALS_CONFIG.Cow.produceTimeMs + ANIMALS_CONFIG.Cow.reHungerDelayMs) - 1;
    const state      = makeState({ cows: { 0: { fedAt: rehungryAt, multiplier: 1 } } });
    const result     = feedCow({ state, action: { type: "cow.feed", index: 0 }, createdAt: NOW });
    expect(result.cows[0].fedAt).toBe(NOW);
  });

  it("tracks Animal Fed activity", () => {
    const state  = makeState();
    const result = feedCow({ state, action: { type: "cow.feed", index: 0 }, createdAt: NOW });
    expect(result.milestones["Animal Fed"]).toBe(1);
  });
});

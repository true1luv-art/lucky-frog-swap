import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { feedSheep } from "./feedSheep";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { SHEEP_TIME_TO_WOOL, SHEEP_RE_HUNGER_DELAY } from "@/shared/game/constants";

const NOW = 1_000_000;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    inventory: { Sheep: new Decimal(2), Cabbage: new Decimal(5) },
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      {},
    sheep:     { 0: { fedAt: undefined, multiplier: 1 }, 1: { fedAt: undefined, multiplier: 1 } },
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

describe("feedSheep", () => {
  it("throws when sheep is already fed and not re-hungry", () => {
    const state = makeState({ sheep: { 0: { fedAt: NOW, multiplier: 1 } } });
    expect(() => feedSheep({ state, action: { type: "sheep.feed", index: 0 }, createdAt: NOW + 1 })).toThrow("Sheep is not hungry");
  });

  it("throws when not enough Cabbage", () => {
    const state = makeState({ inventory: { Sheep: new Decimal(2), Cabbage: new Decimal(0) } });
    expect(() => feedSheep({ state, action: { type: "sheep.feed", index: 0 }, createdAt: NOW })).toThrow("Not enough Cabbage to feed sheep");
  });

  it("feeds an unfed sheep and deducts Cabbage", () => {
    const state  = makeState();
    const result = feedSheep({ state, action: { type: "sheep.feed", index: 0 }, createdAt: NOW });
    expect(result.sheep[0].fedAt).toBe(NOW);
    expect(new Decimal(result.inventory["Cabbage"]!).toNumber()).toBe(4);
  });

  it("allows re-feeding a re-hungry sheep", () => {
    const rehungryAt = NOW - (SHEEP_TIME_TO_WOOL + SHEEP_RE_HUNGER_DELAY) - 1;
    const state      = makeState({ sheep: { 0: { fedAt: rehungryAt, multiplier: 1 } } });
    const result     = feedSheep({ state, action: { type: "sheep.feed", index: 0 }, createdAt: NOW });
    expect(result.sheep[0].fedAt).toBe(NOW);
  });

  it("tracks Animal Fed activity", () => {
    const state  = makeState();
    const result = feedSheep({ state, action: { type: "sheep.feed", index: 0 }, createdAt: NOW });
    expect(result.activity["Animal Fed"]).toBe(1);
  });
});

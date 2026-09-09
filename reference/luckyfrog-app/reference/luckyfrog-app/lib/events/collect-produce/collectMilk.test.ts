import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { collectMilk } from "./collectMilk";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { COW_TIME_TO_MILK } from "@/shared/game/constants";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    inventory: { Cow: new Decimal(2) },
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      {
      0: { fedAt: 1, multiplier: 1 },
      1: { fedAt: 1, multiplier: 1 },
    },
    sheep:     {},
    fishing:   { lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
    cooking:   null,
    stamina:   { current: 100, max: 100 },
    lastStaminaRegenAt: 0,
    skills:    { farming: 0, woodcutting: 0, forestry: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
    bonus:     { ...INITIAL_BONUS },
    activity:  {},
    achievements: {},
    ownedCollectibles: [],
    ...overrides,
  } as unknown as GameState;
}

const READY_AT = COW_TIME_TO_MILK + 1;

describe("collectMilk", () => {
  it("throws when cow index is out of bounds", () => {
    const state = makeState();
    expect(() => collectMilk({ state, action: { type: "cow.collectMilk", index: 5 }, createdAt: READY_AT })).toThrow("Cow does not exist");
  });

  it("throws when cow has not been fed", () => {
    const state = makeState({ cows: { 0: { fedAt: undefined, multiplier: 1 } } });
    expect(() => collectMilk({ state, action: { type: "cow.collectMilk", index: 0 }, createdAt: READY_AT })).toThrow("Cow has not been fed");
  });

  it("throws when milk is not ready yet", () => {
    const state = makeState({ cows: { 0: { fedAt: READY_AT, multiplier: 1 } } });
    expect(() => collectMilk({ state, action: { type: "cow.collectMilk", index: 0 }, createdAt: READY_AT + 1 })).toThrow("Milk is not ready yet");
  });

  it("adds Milk to inventory and resets cow on success", () => {
    const state  = makeState({ cows: { 0: { fedAt: 1, multiplier: 1 } } });
    const result = collectMilk({ state, action: { type: "cow.collectMilk", index: 0 }, createdAt: READY_AT });
    expect(new Decimal(result.inventory["Milk"]!).toNumber()).toBeGreaterThan(0);
    expect(result.cows[0].fedAt).toBeUndefined();
  });

  it("tracks Milk Collected activity and awards husbandry XP", () => {
    const state  = makeState({ cows: { 0: { fedAt: 1, multiplier: 1 } } });
    const result = collectMilk({ state, action: { type: "cow.collectMilk", index: 0 }, createdAt: READY_AT });
    expect(result.activity["Milk Collected"]).toBeGreaterThan(0);
    expect(result.skills.husbandry).toBeGreaterThan(0);
  });
});

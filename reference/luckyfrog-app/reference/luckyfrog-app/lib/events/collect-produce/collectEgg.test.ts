import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { collectEgg } from "./collectEgg";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { CHICKEN_TIME_TO_EGG } from "@/shared/game/constants";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    inventory: { Chicken: new Decimal(2) },
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {
      0: { fedAt: 1, multiplier: 1 },
      1: { fedAt: 1, multiplier: 1 },
    },
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
    ownedCollectibles: [],
    ...overrides,
  } as unknown as GameState;
}

const READY_AT = CHICKEN_TIME_TO_EGG + 1;

describe("collectEgg", () => {
  it("throws when chicken index is out of bounds", () => {
    const state = makeState();
    expect(() => collectEgg({ state, action: { type: "chicken.collectEgg", index: 5 }, createdAt: READY_AT })).toThrow("Chicken does not exist");
    expect(() => collectEgg({ state, action: { type: "chicken.collectEgg", index: -1 }, createdAt: READY_AT })).toThrow("Chicken does not exist");
  });

  it("throws when chicken has not been fed", () => {
    const state = makeState({ chickens: { 0: { fedAt: undefined, multiplier: 1 } } });
    expect(() => collectEgg({ state, action: { type: "chicken.collectEgg", index: 0 }, createdAt: READY_AT })).toThrow("Chicken has not been fed");
  });

  it("throws when egg is not ready yet", () => {
    const state = makeState({ chickens: { 0: { fedAt: READY_AT, multiplier: 1 } } });
    expect(() => collectEgg({ state, action: { type: "chicken.collectEgg", index: 0 }, createdAt: READY_AT + 1 })).toThrow("Egg is not ready yet");
  });

  it("adds Egg to inventory and resets chicken on success", () => {
    const fedAt    = 1;
    const state    = makeState({ chickens: { 0: { fedAt, multiplier: 1 } } });
    const result   = collectEgg({ state, action: { type: "chicken.collectEgg", index: 0 }, createdAt: READY_AT });
    expect(new Decimal(result.inventory["Egg"]!).toNumber()).toBeGreaterThan(0);
    expect(result.chickens[0].fedAt).toBeUndefined();
  });

  it("tracks Egg Collected activity", () => {
    const state  = makeState({ chickens: { 0: { fedAt: 1, multiplier: 1 } } });
    const result = collectEgg({ state, action: { type: "chicken.collectEgg", index: 0 }, createdAt: READY_AT });
    expect(result.activity["Egg Collected"]).toBeGreaterThan(0);
  });

  it("awards husbandry XP", () => {
    const state  = makeState({ chickens: { 0: { fedAt: 1, multiplier: 1 } } });
    const result = collectEgg({ state, action: { type: "chicken.collectEgg", index: 0 }, createdAt: READY_AT });
    expect(result.skills.husbandry).toBeGreaterThan(0);
  });
});

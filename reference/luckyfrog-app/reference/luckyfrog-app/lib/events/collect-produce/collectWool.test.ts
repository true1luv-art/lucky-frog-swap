import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { collectWool } from "./collectWool";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { SHEEP_TIME_TO_WOOL } from "@/shared/game/constants";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    inventory: { Sheep: new Decimal(2) },
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      {},
    sheep:     {
      0: { fedAt: 1, multiplier: 1 },
      1: { fedAt: 1, multiplier: 1 },
    },
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

const READY_AT = SHEEP_TIME_TO_WOOL + 1;

describe("collectWool", () => {
  it("throws when sheep index is out of bounds", () => {
    const state = makeState();
    expect(() => collectWool({ state, action: { type: "sheep.collectWool", index: 5 }, createdAt: READY_AT })).toThrow("Sheep does not exist");
  });

  it("throws when sheep has not been fed", () => {
    const state = makeState({ sheep: { 0: { fedAt: undefined, multiplier: 1 } } });
    expect(() => collectWool({ state, action: { type: "sheep.collectWool", index: 0 }, createdAt: READY_AT })).toThrow("Sheep has not been fed");
  });

  it("throws when wool is not ready yet", () => {
    const state = makeState({ sheep: { 0: { fedAt: READY_AT, multiplier: 1 } } });
    expect(() => collectWool({ state, action: { type: "sheep.collectWool", index: 0 }, createdAt: READY_AT + 1 })).toThrow("Wool is not ready yet");
  });

  it("adds Wool to inventory and resets sheep on success", () => {
    const state  = makeState({ sheep: { 0: { fedAt: 1, multiplier: 1 } } });
    const result = collectWool({ state, action: { type: "sheep.collectWool", index: 0 }, createdAt: READY_AT });
    expect(new Decimal(result.inventory["Wool"]!).toNumber()).toBeGreaterThan(0);
    expect(result.sheep[0].fedAt).toBeUndefined();
  });

  it("tracks Wool Collected activity and awards husbandry XP", () => {
    const state  = makeState({ sheep: { 0: { fedAt: 1, multiplier: 1 } } });
    const result = collectWool({ state, action: { type: "sheep.collectWool", index: 0 }, createdAt: READY_AT });
    expect(result.activity["Wool Collected"]).toBeGreaterThan(0);
    expect(result.skills.husbandry).toBeGreaterThan(0);
  });
});

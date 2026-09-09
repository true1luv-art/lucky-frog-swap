import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { staminaRegen } from "./staminaRegen";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { STAMINA_CONSTANTS } from "@/shared/game/stamina";

const MAX = STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;
const REGEN_MS = STAMINA_CONSTANTS.REGEN_INTERVAL_MS ?? 60_000;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    inventory: {},
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
    stamina:   { current: MAX, max: MAX },
    lastStaminaRegenAt: Date.now(),
    skills:    { farming: 0, woodcutting: 0, forestry: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
    bonus:     { ...INITIAL_BONUS },
    activity:  {},
    achievements: {},
    ...overrides,
  } as unknown as GameState;
}

describe("staminaRegen", () => {
  it("returns the same state when no intervals have elapsed", () => {
    const state  = makeState({ lastStaminaRegenAt: Date.now() });
    const result = staminaRegen({ state, action: { type: "stamina.regenerate" } });
    expect(result).toBe(state);
  });

  it("regenerates stamina when intervals have elapsed", () => {
    const pastTime = Date.now() - REGEN_MS * 3;
    const state    = makeState({ stamina: { current: 10, max: MAX }, lastStaminaRegenAt: pastTime });
    const result   = staminaRegen({ state, action: { type: "stamina.regenerate" } });
    expect(result.stamina.current).toBeGreaterThan(10);
  });

  it("does not exceed max stamina", () => {
    const pastTime = Date.now() - REGEN_MS * 999;
    const state    = makeState({ stamina: { current: MAX - 1, max: MAX }, lastStaminaRegenAt: pastTime });
    const result   = staminaRegen({ state, action: { type: "stamina.regenerate" } });
    expect(result.stamina.current).toBeLessThanOrEqual(MAX);
  });

  it("updates lastStaminaRegenAt when regen occurs", () => {
    const pastTime = Date.now() - REGEN_MS * 3;
    const state    = makeState({ stamina: { current: 10, max: MAX }, lastStaminaRegenAt: pastTime });
    const result   = staminaRegen({ state, action: { type: "stamina.regenerate" } });
    expect(result.lastStaminaRegenAt).toBeGreaterThan(pastTime);
  });
});

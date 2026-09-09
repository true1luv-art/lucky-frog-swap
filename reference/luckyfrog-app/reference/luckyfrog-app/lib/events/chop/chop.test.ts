import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { chop, canChop, CHOP_ERRORS, TREE_RECOVERY_SECONDS } from "./chop";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

const NOW       = 1_000_000_000;
const READY_NOW = NOW + TREE_RECOVERY_SECONDS * 1000 + 1;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    inventory: {},
    fields:    {},
    trees:     { 0: { name: "Wood", choppedAt: 0, amount: 3 } },
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
    skills:    { farming: 0, woodcutting: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
    bonus:     { ...INITIAL_BONUS },
    activity:  {},
    achievements: {},
    ...overrides,
  } as unknown as GameState;
}

describe("canChop", () => {
  it("returns false when tree was just chopped", () => {
    expect(canChop({ name: "Wood", choppedAt: NOW, amount: 3 }, NOW + 1)).toBe(false);
  });

  it("returns true when recovery time has elapsed", () => {
    expect(canChop({ name: "Wood", choppedAt: 0, amount: 3 }, READY_NOW)).toBe(true);
  });
});

describe("chop", () => {
  it("throws when not enough stamina", () => {
    const state = makeState({ stamina: { current: 0, max: 100 } });
    expect(() => chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW })).toThrow("Not enough stamina to chop");
  });

  it("throws when tree does not exist", () => {
    const state = makeState({ trees: {} });
    expect(() => chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW })).toThrow(CHOP_ERRORS.NO_TREE);
  });

  it("throws when tree is still growing", () => {
    const state = makeState({ trees: { 0: { name: "Wood", choppedAt: NOW, amount: 3 } } });
    expect(() => chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: NOW + 1 })).toThrow(CHOP_ERRORS.STILL_GROWING);
  });

  it("adds Wood to inventory on successful chop", () => {
    const state  = makeState();
    const result = chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW });
    expect(new Decimal(result.inventory["Wood"]!).toNumber()).toBeGreaterThan(0);
  });

  it("resets the tree and awards woodcutting XP", () => {
    const state  = makeState();
    const result = chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW });
    expect(result.trees[0].choppedAt).toBe(READY_NOW);
    expect(result.skills.woodcutting).toBeGreaterThan(0);
  });

  it("deducts stamina", () => {
    const state  = makeState();
    const result = chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW });
    expect(result.stamina.current).toBeLessThan(100);
  });
});

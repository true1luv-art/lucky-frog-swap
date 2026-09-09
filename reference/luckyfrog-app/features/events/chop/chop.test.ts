import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { chop, canChop, CHOP_ERRORS, TREE_RECOVERY_SECONDS } from "./chop";
import type { GameState } from "@/features/types/gameplay/game";

const NOW       = 1_000_000_000;
const READY_NOW = NOW + TREE_RECOVERY_SECONDS * 1000 + 1;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    items: { Axe: new Decimal(10) },
    fields:    {},
    trees:     { 0: { name: "Wood", choppedAt: 0 } },
    stones:    {},
    iron:      {},
    emerald:   {},
    diamond:   {},
    ignisite:  {},
    chickens:  {},
    cows:      {},
    sheep:     {},
    fishing:   { lastCastAt: 0, lastCaughtFish: null },
    cooking:   null,
    skills:    {
      farming: 0, woodcutting: 0, mining: 0, fishing: 0,
      husbandry: 0, combat: 0, cooking: 0, smithing: 0,
    },
    milestones: {},
    ...overrides,
  } as unknown as GameState;
}

describe("canChop", () => {
  it("returns false when tree was just chopped", () => {
    expect(canChop({ name: "Wood", choppedAt: NOW }, NOW + 1)).toBe(false);
  });

  it("returns true when recovery time has elapsed", () => {
    expect(canChop({ name: "Wood", choppedAt: 0 }, READY_NOW)).toBe(true);
  });
});

describe("chop", () => {
  it("throws when out of axes", () => {
    const state = makeState({ items: { Axe: new Decimal(0) } });
    expect(() => chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW })).toThrow(CHOP_ERRORS.NO_AXES);
  });

  it("deducts an axe per chop", () => {
    const state  = makeState();
    const result = chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW });
    expect(new Decimal(result.items["Axe"]!).toNumber()).toBe(9);
  });

  it("throws when tree does not exist", () => {
    const state = makeState({ trees: {} });
    expect(() => chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW })).toThrow(CHOP_ERRORS.NO_TREE);
  });

  it("throws when tree is still growing", () => {
    const state = makeState({ trees: { 0: { name: "Wood", choppedAt: NOW } } });
    expect(() => chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: NOW + 1 })).toThrow(CHOP_ERRORS.STILL_GROWING);
  });

  it("adds Wood to inventory on successful chop", () => {
    const state  = makeState();
    const result = chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW });
    expect(new Decimal(result.items["Wood"]!).toNumber()).toBeGreaterThan(0);
  });

  it("resets the tree and awards woodcutting XP", () => {
    const state  = makeState();
    const result = chop({ state, action: { type: "tree.chopped", index: 0 }, createdAt: READY_NOW });
    expect(result.trees[0].choppedAt).toBe(READY_NOW);
    expect(result.skills.woodcutting).toBeGreaterThan(0);
  });
});

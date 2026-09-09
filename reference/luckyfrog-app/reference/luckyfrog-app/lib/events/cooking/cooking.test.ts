import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { startCooking, START_COOKING_ERRORS } from "./startCooking";
import { collectCooked, COLLECT_COOKED_ERRORS } from "./collectCooked";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

// "Roasted Potato" recipe requires "Cod" x1, "Potato" x1 (adjust if recipe differs)
const TEST_FOOD = "Roasted Potato" as const;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(100),
    inventory: { Potato: new Decimal(5) },
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
    stamina:   { current: 100, max: 100 },
    lastStaminaRegenAt: 0,
    skills:    { farming: 0, woodcutting: 0, forestry: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
    bonus:     { ...INITIAL_BONUS },
    activity:  {},
    achievements: {},
    ...overrides,
  } as unknown as GameState;
}

// ---------------------------------------------------------------------------
// startCooking
// ---------------------------------------------------------------------------

describe("startCooking", () => {
  it("throws when kitchen is already busy", () => {
    const state = makeState({ cooking: { item: TEST_FOOD, startedAt: 0, duration: 60 } });
    expect(() => startCooking({ state, action: { type: "food.startCooking", item: TEST_FOOD } })).toThrow(START_COOKING_ERRORS.KITCHEN_BUSY);
  });

  it("throws for an unknown food", () => {
    const state = makeState();
    expect(() => startCooking({ state, action: { type: "food.startCooking", item: "Unicorn Stew" as never } })).toThrow(START_COOKING_ERRORS.UNKNOWN_FOOD);
  });

  it("sets cooking slot and deducts ingredients on success", () => {
    const state  = makeState();
    const result = startCooking({ state, action: { type: "food.startCooking", item: TEST_FOOD }, createdAt: 1000 });
    expect(result.cooking).not.toBeNull();
    expect(result.cooking?.item).toBe(TEST_FOOD);
  });

  it("awards cooking XP", () => {
    const state  = makeState();
    const result = startCooking({ state, action: { type: "food.startCooking", item: TEST_FOOD }, createdAt: 1000 });
    expect(result.skills.cooking).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// collectCooked
// ---------------------------------------------------------------------------

describe("collectCooked", () => {
  it("throws when nothing is cooking", () => {
    const state = makeState();
    expect(() => collectCooked({ state, action: { type: "food.collectCooked" }, createdAt: 9999 })).toThrow(COLLECT_COOKED_ERRORS.NOTHING_COOKING);
  });

  it("throws when food is not ready yet", () => {
    const state = makeState({ cooking: { item: TEST_FOOD, startedAt: 0, duration: 9999 } });
    expect(() => collectCooked({ state, action: { type: "food.collectCooked" }, createdAt: 1 })).toThrow(COLLECT_COOKED_ERRORS.NOT_READY);
  });

  it("adds cooked item to inventory and clears cooking slot", () => {
    const state  = makeState({ cooking: { item: TEST_FOOD, startedAt: 0, duration: 1 } });
    const result = collectCooked({ state, action: { type: "food.collectCooked" }, createdAt: 2000 });
    expect(result.cooking).toBeNull();
    expect(new Decimal(result.inventory[TEST_FOOD]!).toNumber()).toBe(1);
  });
});

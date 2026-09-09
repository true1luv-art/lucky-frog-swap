import { describe, it, expect, vi } from "vitest";
import Decimal from "decimal.js-light";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

// screenTracker.calculate() must return true for plant() to succeed
vi.mock("@/lib/utils/screen", () => ({ screenTracker: { calculate: () => true } }));

import { plant, isSeed, getCropTime } from "./plant";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(100),
    inventory: { "Potato Seed": new Decimal(5) },
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

describe("isSeed", () => {
  it("returns true for valid seed names", () => {
    expect(isSeed("Potato Seed")).toBe(true);
    expect(isSeed("Kale Seed")).toBe(true);
  });

  it("returns false for non-seed items", () => {
    expect(isSeed("Potato")).toBe(false);
    expect(isSeed("Wood")).toBe(false);
  });
});

describe("getCropTime", () => {
  it("returns a positive number for a known crop", () => {
    expect(getCropTime("Potato", {})).toBeGreaterThan(0);
  });
});

describe("plant", () => {
  it("plants a crop and deducts seed from inventory", () => {
    const state  = makeState();
    const result = plant({ state, action: { type: "item.planted", item: "Potato Seed", index: 0 }, createdAt: 1000 });
    expect(result.fields[0]).toBeDefined();
    expect(result.fields[0].name).toBe("Potato");
    expect(new Decimal(result.inventory["Potato Seed"]!).toNumber()).toBe(4);
  });

  it("throws when field index is out of range", () => {
    const state = makeState();
    expect(() => plant({ state, action: { type: "item.planted", item: "Potato Seed", index: 30 } })).toThrow("Field does not exist");
    expect(() => plant({ state, action: { type: "item.planted", item: "Potato Seed", index: -1 } })).toThrow("Field does not exist");
  });

  it("throws when field is already occupied", () => {
    const state = makeState({ fields: { 0: { name: "Potato", plantedAt: 0, amount: 1 } } });
    expect(() => plant({ state, action: { type: "item.planted", item: "Potato Seed", index: 0 } })).toThrow("Crop is already planted");
  });

  it("throws when no item is selected", () => {
    const state = makeState();
    expect(() => plant({ state, action: { type: "item.planted", index: 0 } })).toThrow("No seed selected");
  });

  it("throws when item is not a seed", () => {
    const state = makeState({ inventory: { Potato: new Decimal(5) } });
    expect(() => plant({ state, action: { type: "item.planted", item: "Potato", index: 0 } })).toThrow("Not a seed");
  });

  it("throws when not enough seeds", () => {
    const state = makeState({ inventory: { "Potato Seed": new Decimal(0) } });
    expect(() => plant({ state, action: { type: "item.planted", item: "Potato Seed", index: 0 } })).toThrow("Not enough seeds");
  });

  it("enforces the selected seed farming level", () => {
    const state = makeState({ inventory: { "Kale Seed": new Decimal(1) } });
    expect(() =>
      plant({ state, action: { type: "item.planted", item: "Kale Seed", index: 0 } }),
    ).toThrow("Seed requires Farming Level 15");
  });
});

import { describe, it, expect, vi } from "vitest";
import Decimal from "decimal.js-light";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { CROPS } from "@/shared/types/gameplay/crops";

vi.mock("@/lib/utils/screen", () => ({ screenTracker: { calculate: () => true } }));

import { harvest } from "./harvest";

const POTATO_SECONDS = CROPS()["Potato"].harvestSeconds;
const NOW = POTATO_SECONDS * 1000 + 1;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    inventory: {},
    fields:    { 0: { name: "Potato", plantedAt: 0, amount: 1 } },
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

describe("harvest", () => {
  it("throws when not enough stamina", () => {
    const state = makeState({ stamina: { current: 0, max: 100 } });
    expect(() => harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW })).toThrow("Not enough stamina");
  });

  it("throws when field index is out of range", () => {
    const state = makeState();
    expect(() => harvest({ state, action: { type: "item.harvested", index: 30 }, createdAt: NOW })).toThrow("Field does not exist");
  });

  it("throws when field is empty", () => {
    const state = makeState({ fields: {} });
    expect(() => harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW })).toThrow("Nothing was planted");
  });

  it("throws when crop is not ready", () => {
    const state = makeState({ fields: { 0: { name: "Potato", plantedAt: NOW, amount: 1 } } });
    expect(() => harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW + 1 })).toThrow("Not ready");
  });

  it("harvests a ready crop, adds to inventory, and removes field", () => {
    const state  = makeState();
    const result = harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW });
    expect(result.fields[0]).toBeUndefined();
    expect(new Decimal(result.inventory["Potato"]!).toNumber()).toBeGreaterThan(0);
  });

  it("awards farming XP on harvest", () => {
    const state  = makeState();
    const result = harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW });
    expect(result.skills.farming).toBeGreaterThan(0);
  });

  it("deducts stamina on harvest", () => {
    const state  = makeState();
    const result = harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW });
    expect(result.stamina.current).toBeLessThan(100);
  });
});

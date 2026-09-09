import { describe, it, expect, vi } from "vitest";
import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay/game";
import { CROPS } from "@/features/types/gameplay/crops";

vi.mock("@/features/utils/screen", () => ({ screenTracker: { calculate: () => true } }));

import { harvest } from "./harvest";

const POTATO_SECONDS = CROPS()["Potato"].harvestSeconds;
const NOW = POTATO_SECONDS * 1000 + 1;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    items: {},
    fields:    { 0: { name: "Potato", plantedAt: 0 } },
    trees:     {},
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

describe("harvest", () => {
  it("throws when field index is out of range", () => {
    const state = makeState();
    expect(() => harvest({ state, action: { type: "item.harvested", index: 99 }, createdAt: NOW })).toThrow("Field does not exist");
  });

  it("throws when field is empty", () => {
    const state = makeState({ fields: {} });
    expect(() => harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW })).toThrow("Nothing was planted");
  });

  it("throws when crop is not ready", () => {
    const state = makeState({ fields: { 0: { name: "Potato", plantedAt: NOW } } });
    expect(() => harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW + 1 })).toThrow("Not ready");
  });

  it("harvests a ready crop, adds to inventory, and removes field", () => {
    const state  = makeState();
    const result = harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW });
    expect(result.fields[0]).toBeUndefined();
    expect(new Decimal(result.items["Potato"]!).toNumber()).toBeGreaterThan(0);
  });

  it("awards farming XP on harvest", () => {
    const state  = makeState();
    const result = harvest({ state, action: { type: "item.harvested", index: 0 }, createdAt: NOW });
    expect(result.skills.farming).toBeGreaterThan(0);
  });
});

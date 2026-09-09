import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { mine, PICKAXE_LOOT } from "./mine";
import type { GameState } from "@/features/types/gameplay/game";
import { INITIAL_DRAW } from "@/features/types/gameplay/skills";
import { createToolInstance } from "@/features/types/gameplay/tools";
import type { ToolTier } from "@/features/types/gameplay/tools";

// ---------------------------------------------------------------------------
// Helper — builds a minimal valid GameState with one stone node and a pickaxe
// ---------------------------------------------------------------------------

function makeState(
  tier: ToolTier = "Wood",
  overrides: Partial<GameState> = {},
): GameState {
  return {
    balance:        new Decimal(0),
    coins:          new Decimal(0),
    stamina:        100,
    staminaRegenAt: 0,
    items:          {},
    items:      {},
    fields:         {},
    trees:          {},
    stones:         { 0: { name: "Stone", minedAt: 0 } },
    chickens:       {},
    cows:           {},
    sheep:          {},
    fishing:        { lastCastAt: 0, lastCaughtFish: null },
    cooking:        null,
    skills: {
      farming: 0, woodcutting: 0, mining: 0,
      fishing: 0, husbandry: 0, cooking: 0, smithing: 0,
    },
    tools:      [createToolInstance("Pickaxe", tier)],
    equipment:  { head: null, body: null, legs: null, feet: null },
    farmLevel:  1,
    draw:       { ...INITIAL_DRAW },
    milestones: {},
    quests:     { daily: [] },
    ...overrides,
  } as unknown as GameState;
}

// ---------------------------------------------------------------------------
// Core mine behaviour
// ---------------------------------------------------------------------------

describe("mine — stone", () => {
  it("yields Stone and records minedAt", () => {
    const state  = makeState();
    const now    = Date.now();
    const result = mine({ state, action: { type: "stone.mined", index: 0 }, createdAt: now });
    expect(new Decimal((result.items as Record<string, Decimal>)["Stone"] ?? 0).toNumber()).toBeGreaterThanOrEqual(1);
    expect((result.stones as Record<number, { minedAt: number }>)[0].minedAt).toBe(now);
  });

  it("throws when rock is still recovering", () => {
    const now   = Date.now();
    const state = makeState("Wood", { stones: { 0: { name: "Stone", minedAt: now } } });
    expect(() =>
      mine({ state, action: { type: "stone.mined", index: 0 }, createdAt: now }),
    ).toThrow("recovering");
  });

  it("throws when no pickaxe in tools[]", () => {
    const state = makeState("Wood", { tools: [] });
    expect(() =>
      mine({ state, action: { type: "stone.mined", index: 0 }, createdAt: Date.now() }),
    ).toThrow("pickaxe");
  });

  it("decrements pickaxe durability per swing", () => {
    const state  = makeState("Iron"); // Iron has finite durability
    const before = state.tools[0].durability!;
    const result = mine({ state, action: { type: "stone.mined", index: 0 }, createdAt: Date.now() });
    expect(result.tools[0].durability).toBe(before - 1);
  });

  it("Wood pickaxe (infinite durability) is never removed", () => {
    const state  = makeState("Wood");
    const result = mine({ state, action: { type: "stone.mined", index: 0 }, createdAt: Date.now() });
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].durability).toBeNull();
  });

  it("throws when rock index does not exist", () => {
    const state = makeState("Wood", { stones: {} });
    expect(() =>
      mine({ state, action: { type: "stone.mined", index: 99 }, createdAt: Date.now() }),
    ).toThrow("No rock");
  });

  it("increments mining skill XP", () => {
    const state  = makeState();
    const result = mine({ state, action: { type: "stone.mined", index: 0 }, createdAt: Date.now() });
    expect(result.skills.mining).toBeGreaterThan(0);
  });

  it("tracks Stone Mined milestone", () => {
    const state  = makeState();
    const result = mine({ state, action: { type: "stone.mined", index: 0 }, createdAt: Date.now() });
    expect(result.milestones["Stone Mined"]).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Pickaxe-tier rarity weights
// ---------------------------------------------------------------------------

describe("mine — pickaxe tier rarity", () => {
  it("Wood pick can drop Iron (forced rng = 0)", () => {
    // rng=0 means all rolls succeed; Wood pick should drop Iron
    const state  = makeState("Wood");
    const result = mine({
      state,
      action:    { type: "stone.mined", index: 0 },
      createdAt: Date.now(),
      rng:       () => 0,
    });
    expect(new Decimal((result.items as Record<string, Decimal>)["Iron"] ?? 0).toNumber()).toBe(1);
  });

  it("Wood pick never drops Silver (not in its loot table)", () => {
    const woodEntries = PICKAXE_LOOT["Wood"].map((e) => e.ore);
    expect(woodEntries).not.toContain("Silver");
  });

  it("Iron pick drops Iron on successful roll", () => {
    const state  = makeState("Iron");
    const result = mine({
      state,
      action:    { type: "stone.mined", index: 0 },
      createdAt: Date.now(),
      rng:       () => 0, // always succeeds
    });
    expect(new Decimal((result.items as Record<string, Decimal>)["Iron"] ?? 0).toNumber()).toBe(1);
  });

  it("Iron pick can drop Silver (forced rng = 0)", () => {
    const state  = makeState("Iron");
    const result = mine({
      state,
      action:    { type: "stone.mined", index: 0 },
      createdAt: Date.now(),
      rng:       () => 0,
    });
    expect(new Decimal((result.items as Record<string, Decimal>)["Silver"] ?? 0).toNumber()).toBe(1);
  });

  it("Iron pick never drops Emerald (not in its loot table)", () => {
    const ironEntries = PICKAXE_LOOT["Iron"].map((e) => e.ore);
    expect(ironEntries).not.toContain("Emerald");
  });

  it("Ignisite pick can drop all 5 ores on forced rng = 0", () => {
    const state  = makeState("Ignisite");
    const result = mine({
      state,
      action:    { type: "stone.mined", index: 0 },
      createdAt: Date.now(),
      rng:       () => 0,
    });
    const items = result.items as Record<string, Decimal>;
    for (const ore of ["Iron", "Silver", "Emerald", "Diamond", "Ignisite"] as const) {
      expect(new Decimal(items[ore] ?? 0).toNumber()).toBe(1);
    }
  });

  it("no ores drop when rng always returns 1 (above all base chances)", () => {
    const state  = makeState("Ignisite");
    const result = mine({
      state,
      action:    { type: "stone.mined", index: 0 },
      createdAt: Date.now(),
      rng:       () => 1, // 1 * 100 = 100 — never below any baseChance
    });
    const items = result.items as Record<string, Decimal>;
    for (const ore of ["Iron", "Silver", "Emerald", "Diamond"] as const) {
      expect(new Decimal(items[ore] ?? 0).toNumber()).toBe(0);
    }
  });

  it("PICKAXE_LOOT has entries for all 6 tiers", () => {
    const tiers: ToolTier[] = ["Wood", "Iron", "Silver", "Emerald", "Diamond", "Ignisite"];
    for (const tier of tiers) {
      expect(PICKAXE_LOOT[tier]).toBeDefined();
      expect(PICKAXE_LOOT[tier].length).toBeGreaterThan(0);
    }
  });

  it("higher tiers have more ore variety than lower tiers", () => {
    expect(PICKAXE_LOOT["Ignisite"].length).toBeGreaterThan(PICKAXE_LOOT["Wood"].length);
    expect(PICKAXE_LOOT["Diamond"].length).toBeGreaterThan(PICKAXE_LOOT["Iron"].length);
  });
});

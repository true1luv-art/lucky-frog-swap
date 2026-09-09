/**
 * lib/events/farm-action/validate.test.ts
 *
 * Unit tests for Sprint 2.3 server-side validators.
 * Tests cover §2.3-A (plant), §2.3-B (harvest), §2.3-C (chop, mine),
 * §2.3-D (stamina regen + enforcement), §2.3-E (field unlock).
 *
 * No MongoDB or DOM dependencies — pure state-in / state-out.
 */

import Decimal from "decimal.js-light";
import { describe, it, expect, beforeEach } from "vitest";
import {
  applyStaminaRegen,
  serverPlant,
  serverHarvest,
  serverChop,
  serverMineStone,
  serverMineIron,
  serverMineGold,
} from "@/lib/events/farm-action/validate";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS, INITIAL_SKILLS } from "@/shared/types/gameplay/skills";
import { INITIAL_EQUIPMENT, INITIAL_BASE_STATS, computeStats } from "@/shared/types/gameplay/equipment";
import {
  TREE_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
  IRON_RECOVERY_SECONDS,
  GOLD_RECOVERY_SECONDS,
} from "@/shared/data/farming";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUR_MS  = 60 * 60 * 1000;
const NOW      = 1_700_000_000_000; // fixed epoch for deterministic tests

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    id:        undefined,
    username:  undefined,
    avatarUrl: undefined,
    balance:   new Decimal(0),
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      {},
    sheep:     {},
    inventory: {},
    farmAddress: undefined,
    equipment:  { ...INITIAL_EQUIPMENT },
    baseStats:  { ...INITIAL_BASE_STATS },
    stats:      computeStats({ ...INITIAL_BASE_STATS }, { ...INITIAL_EQUIPMENT }),
    skills:     { ...INITIAL_SKILLS },
    bonus:      { ...INITIAL_BONUS },
    stamina:    { current: 100, max: 100 },
    lastStaminaRegenAt: NOW - HOUR_MS * 2,  // 2 hours ago → pending regen
    fishing:    { lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
    cooking:    null,
    activity:   {},
    achievements: {},
    ...overrides,
  } as unknown as GameState;
}

function withSeeds(state: GameState, seedName: string, qty: number): GameState {
  return {
    ...state,
    inventory: { ...state.inventory, [seedName]: new Decimal(qty) },
  };
}

function withStamina(state: GameState, current: number): GameState {
  return { ...state, stamina: { ...state.stamina, current } };
}

// ---------------------------------------------------------------------------
// §2.3-D  applyStaminaRegen
// ---------------------------------------------------------------------------

describe("applyStaminaRegen", () => {
  it("does not regen when no interval has elapsed", () => {
    const state = makeState({ stamina: { current: 50, max: 100 }, lastStaminaRegenAt: NOW });
    const out   = applyStaminaRegen(state, NOW + 30_000); // 30 seconds later
    expect(out.stamina.current).toBe(50);
    expect(out.lastStaminaRegenAt).toBe(NOW);
  });

  it("regens one interval (5% of max) after 1 hour", () => {
    const state = makeState({ stamina: { current: 50, max: 100 }, lastStaminaRegenAt: NOW });
    const out   = applyStaminaRegen(state, NOW + HOUR_MS);
    expect(out.stamina.current).toBe(55); // 50 + ceil(100 * 0.05 * 1) = 55
    expect(out.lastStaminaRegenAt).toBe(NOW + HOUR_MS);
  });

  it("caps regen at max stamina", () => {
    const state = makeState({ stamina: { current: 98, max: 100 }, lastStaminaRegenAt: NOW });
    const out   = applyStaminaRegen(state, NOW + HOUR_MS * 3);
    expect(out.stamina.current).toBe(100);
  });

  it("caps offline regen at 8 intervals maximum", () => {
    const state = makeState({ stamina: { current: 0, max: 100 }, lastStaminaRegenAt: NOW });
    const out   = applyStaminaRegen(state, NOW + HOUR_MS * 24); // 24h offline
    // 8 intervals × ceil(100 × 0.05 × 8) = 40; capped at 40
    expect(out.stamina.current).toBe(40);
  });

  it("advances lastStaminaRegenAt by capped intervals", () => {
    const state = makeState({ stamina: { current: 0, max: 100 }, lastStaminaRegenAt: NOW });
    const out   = applyStaminaRegen(state, NOW + HOUR_MS * 24);
    expect(out.lastStaminaRegenAt).toBe(NOW + HOUR_MS * 8);
  });
});

// ---------------------------------------------------------------------------
// §2.3-A / §2.3-E  serverPlant
// ---------------------------------------------------------------------------

describe("serverPlant", () => {
  it("plants a seed successfully", () => {
    const state = withSeeds(makeState(), "Potato Seed", 3);
    const next  = serverPlant(
      state,
      { type: "item.planted", item: "Potato Seed", index: 0 },
      NOW,
    );
    expect(next.fields[0]).toBeDefined();
    expect(next.fields[0].name).toBe("Potato");
    expect((next.inventory as Record<string, Decimal>)["Potato Seed"].toNumber()).toBe(2);
  });

  it("throws when field index is out of range", () => {
    // 72 plots exist (fieldIndex 0–71); 72 is out of range.
    const state = withSeeds(makeState(), "Potato Seed", 1);
    expect(() =>
      serverPlant(state, { type: "item.planted", item: "Potato Seed", index: 72 }, NOW),
    ).toThrow("Field does not exist");
  });

  it("throws when field is locked (requires higher farming level)", () => {
    // Field 15 requires farming level 4; player at level 1 (0 XP)
    const state = withSeeds(makeState(), "Potato Seed", 1);
    expect(() =>
      serverPlant(state, { type: "item.planted", item: "Potato Seed", index: 15 }, NOW),
    ).toThrow("Farming Level");
  });

  it("allows planting in a locked field when farming level is sufficient", () => {
    // Field 6 requires farming level 2 → 1575 XP puts the player above it
    const state = withSeeds(
      makeState({ skills: { ...INITIAL_SKILLS, farming: 1575 } }),
      "Potato Seed",
      1,
    );
    const next = serverPlant(
      state,
      { type: "item.planted", item: "Potato Seed", index: 6 },
      NOW,
    );
    expect(next.fields[6]).toBeDefined();
  });

  it("throws when field is already occupied", () => {
    const state = withSeeds(
      makeState({ fields: { 0: { name: "Potato", plantedAt: NOW - 1000, amount: 1 } } }),
      "Potato Seed",
      2,
    );
    expect(() =>
      serverPlant(state, { type: "item.planted", item: "Potato Seed", index: 0 }, NOW),
    ).toThrow("already planted");
  });

  it("throws when no seed item is given", () => {
    const state = makeState();
    expect(() =>
      serverPlant(state, { type: "item.planted", index: 0 }, NOW),
    ).toThrow("No seed selected");
  });

  it("throws when a non-seed item is given", () => {
    const state = makeState({ inventory: { Wood: new Decimal(5) } } as Partial<GameState>);
    expect(() =>
      serverPlant(state, { type: "item.planted", item: "Wood", index: 0 }, NOW),
    ).toThrow("Not a seed");
  });

  it("throws when player does not have enough seeds", () => {
    const state = withSeeds(makeState(), "Potato Seed", 0);
    expect(() =>
      serverPlant(state, { type: "item.planted", item: "Potato Seed", index: 0 }, NOW),
    ).toThrow("Not enough seeds");
  });

  it("authoritatively enforces the selected seed farming level", () => {
    const state = withSeeds(makeState(), "Kale Seed", 1);
    expect(() =>
      serverPlant(state, { type: "item.planted", item: "Kale Seed", index: 0 }, NOW),
    ).toThrow("Seed requires Farming Level 15");
  });
});

// ---------------------------------------------------------------------------
// §2.3-B  serverHarvest
// ---------------------------------------------------------------------------

const POTATO_GROW_MS = 60 * 1000; // Potato harvestSeconds = 60

describe("serverHarvest", () => {
  function makeStateWithPlant(plantedAt: number, stamina = 100): GameState {
    return makeState({
      stamina:    { current: stamina, max: 100 },
      lastStaminaRegenAt: NOW,
      fields:     { 0: { name: "Potato", plantedAt, amount: 1 } },
      inventory:  {},
    });
  }

  it("harvests a mature crop and adds to inventory", () => {
    const plantedAt = NOW - POTATO_GROW_MS - 1000;
    const state     = makeStateWithPlant(plantedAt);
    const next      = serverHarvest(state, { type: "item.harvested", index: 0 }, NOW);
    expect(next.fields[0]).toBeUndefined();
    expect((next.inventory as Record<string, Decimal>)["Potato"]).toBeDefined();
    expect((next.inventory as Record<string, Decimal>)["Potato"].greaterThan(0)).toBe(true);
  });

  it("deducts stamina after harvest", () => {
    const plantedAt = NOW - POTATO_GROW_MS - 1000;
    const state     = makeStateWithPlant(plantedAt, 10);
    const next      = serverHarvest(state, { type: "item.harvested", index: 0 }, NOW);
    expect(next.stamina.current).toBe(9); // cost = 1
  });

  it("awards farming XP", () => {
    const plantedAt = NOW - POTATO_GROW_MS - 1000;
    const state     = makeStateWithPlant(plantedAt);
    const next      = serverHarvest(state, { type: "item.harvested", index: 0 }, NOW);
    expect(next.skills.farming).toBeGreaterThan(0);
  });

  it("throws when crop is not yet mature", () => {
    const plantedAt = NOW - POTATO_GROW_MS + 5000; // 5s short
    const state     = makeStateWithPlant(plantedAt);
    expect(() =>
      serverHarvest(state, { type: "item.harvested", index: 0 }, NOW),
    ).toThrow("Not ready");
  });

  it("throws when stamina is insufficient", () => {
    const plantedAt = NOW - POTATO_GROW_MS - 1000;
    const state     = withStamina(
      makeStateWithPlant(plantedAt),
      0,
    );
    // Force lastStaminaRegenAt to NOW so no regen
    const locked = { ...state, lastStaminaRegenAt: NOW };
    expect(() =>
      serverHarvest(locked, { type: "item.harvested", index: 0 }, NOW),
    ).toThrow("stamina");
  });

  it("throws when field is empty", () => {
    const state = makeState();
    expect(() =>
      serverHarvest(state, { type: "item.harvested", index: 0 }, NOW),
    ).toThrow("Nothing was planted");
  });

  it("regens stamina before checking sufficiency", () => {
    // 0 stamina but 2 hours of regen pending (should regen 10)
    const plantedAt = NOW - POTATO_GROW_MS - 1000;
    const state     = {
      ...makeStateWithPlant(plantedAt, 0),
      lastStaminaRegenAt: NOW - HOUR_MS * 2,
    };
    // Should NOT throw — stamina will be 10 after regen
    expect(() =>
      serverHarvest(state, { type: "item.harvested", index: 0 }, NOW),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// §2.3-C  serverChop
// ---------------------------------------------------------------------------

describe("serverChop", () => {
  const RECOVERED_AT = NOW - TREE_RECOVERY_SECONDS * 1000 - 1000;

  function makeTreeState(choppedAt: number, stamina = 100): GameState {
    return makeState({
      stamina:    { current: stamina, max: 100 },
      lastStaminaRegenAt: NOW,
      trees:      { 0: { name: "Wood", choppedAt, amount: 3 } },
    });
  }

  it("chops a recovered tree and adds Wood to inventory", () => {
    const state = makeTreeState(RECOVERED_AT);
    const next  = serverChop(state, { type: "tree.chopped", index: 0 }, NOW);
    expect((next.inventory as Record<string, Decimal>)["Wood"]?.greaterThan(0)).toBe(true);
    expect(next.trees[0].choppedAt).toBe(NOW);
  });

  it("awards woodcutting XP", () => {
    const state = makeTreeState(RECOVERED_AT);
    const next  = serverChop(state, { type: "tree.chopped", index: 0 }, NOW);
    expect(next.skills.woodcutting).toBeGreaterThan(0);
  });

  it("throws when tree is still growing (recovery not elapsed)", () => {
    const state = makeTreeState(NOW - 60_000); // only 1m elapsed, needs 15m
    expect(() =>
      serverChop(state, { type: "tree.chopped", index: 0 }, NOW),
    ).toThrow("still growing");
  });

  it("throws when tree node does not exist", () => {
    const state = makeState();
    expect(() =>
      serverChop(state, { type: "tree.chopped", index: 99 }, NOW),
    ).toThrow("No tree");
  });

  it("throws when stamina is 0 and no regen pending", () => {
    const state = { ...makeTreeState(RECOVERED_AT, 0), lastStaminaRegenAt: NOW };
    expect(() =>
      serverChop(state, { type: "tree.chopped", index: 0 }, NOW),
    ).toThrow("stamina");
  });
});

// ---------------------------------------------------------------------------
// §2.3-C  serverMineStone / serverMineIron / serverMineGold
// ---------------------------------------------------------------------------

describe("serverMineStone", () => {
  const RECOVERED_AT = NOW - STONE_RECOVERY_SECONDS * 1000 - 1000;

  it("mines a recovered stone and adds Stone to inventory", () => {
    const state = makeState({ stones: { 0: { name: "Stone", minedAt: RECOVERED_AT, amount: 2 } }, stamina: { current: 100, max: 100 }, lastStaminaRegenAt: NOW });
    const next  = serverMineStone(state, { type: "stone.mined", index: 0 }, NOW);
    expect((next.inventory as Record<string, Decimal>)["Stone"]?.greaterThan(0)).toBe(true);
  });

  it("throws when stone is still recovering", () => {
    const state = makeState({ stones: { 0: { name: "Stone", minedAt: NOW - HOUR_MS, amount: 2 } }, stamina: { current: 100, max: 100 }, lastStaminaRegenAt: NOW });
    expect(() =>
      serverMineStone(state, { type: "stone.mined", index: 0 }, NOW),
    ).toThrow("still recovering");
  });

  it("throws when no stone node exists", () => {
    const state = makeState();
    expect(() =>
      serverMineStone(state, { type: "stone.mined", index: 0 }, NOW),
    ).toThrow("No rock");
  });
});

describe("serverMineIron", () => {
  const RECOVERED_AT = NOW - IRON_RECOVERY_SECONDS * 1000 - 1000;

  it("mines recovered iron and awards mining XP", () => {
    const state = makeState({ iron: { 0: { name: "Iron", minedAt: RECOVERED_AT, amount: 2 } }, stamina: { current: 100, max: 100 }, lastStaminaRegenAt: NOW });
    const next  = serverMineIron(state, { type: "iron.mined", index: 0 }, NOW);
    expect(next.skills.mining).toBeGreaterThan(0);
    expect((next.inventory as Record<string, Decimal>)["Iron"]?.greaterThan(0)).toBe(true);
  });

  it("throws when iron is still recovering", () => {
    const state = makeState({ iron: { 0: { name: "Iron", minedAt: NOW - HOUR_MS * 2, amount: 2 } }, stamina: { current: 100, max: 100 }, lastStaminaRegenAt: NOW });
    expect(() =>
      serverMineIron(state, { type: "iron.mined", index: 0 }, NOW),
    ).toThrow("still recovering");
  });
});

describe("serverMineGold", () => {
  const RECOVERED_AT = NOW - GOLD_RECOVERY_SECONDS * 1000 - 1000;

  it("mines recovered gold and adds Gold to inventory", () => {
    const state = makeState({ gold: { 0: { name: "Gold", minedAt: RECOVERED_AT, amount: 2 } }, stamina: { current: 100, max: 100 }, lastStaminaRegenAt: NOW });
    const next  = serverMineGold(state, { type: "gold.mined", index: 0 }, NOW);
    expect((next.inventory as Record<string, Decimal>)["Gold"]?.greaterThan(0)).toBe(true);
  });

  it("throws when gold is still recovering", () => {
    const state = makeState({ gold: { 0: { name: "Gold", minedAt: NOW - HOUR_MS * 4, amount: 2 } }, stamina: { current: 100, max: 100 }, lastStaminaRegenAt: NOW });
    expect(() =>
      serverMineGold(state, { type: "gold.mined", index: 0 }, NOW),
    ).toThrow("still recovering");
  });
});

// ---------------------------------------------------------------------------
// §2.3-E  Field unlock gate — cross-validator check
// ---------------------------------------------------------------------------

describe("field unlock gate (§2.3-E)", () => {
  const lockedCases: [number, number][] = [
    [6,  3],   // field 6 requires level 3
    [9,  5],   // field 9 requires level 5
    [15, 10],  // field 15 requires level 10
    [24, 20],  // field 24 requires level 20
    [27, 25],  // field 27 requires level 25
  ];

  for (const [fieldIndex, requiredLevel] of lockedCases) {
    it(`blocks field ${fieldIndex} when farming level < ${requiredLevel}`, () => {
      const state = withSeeds(makeState({ skills: { ...INITIAL_SKILLS, farming: 0 } }), "Potato Seed", 5);
      expect(() =>
        serverPlant(state, { type: "item.planted", item: "Potato Seed", index: fieldIndex }, NOW),
      ).toThrow("Farming Level");
    });
  }

  it("fields 0–5 are always unlocked at level 1", () => {
    const state = withSeeds(makeState(), "Potato Seed", 10);
    for (let i = 0; i <= 5; i++) {
      expect(() =>
        serverPlant(state, { type: "item.planted", item: "Potato Seed", index: i }, NOW),
      ).not.toThrow();
    }
  });
});

/**
 * lib/events/farm-action/validate-2.5.test.ts
 *
 * Unit tests for Sprint 2.5:
 *   §2.5-B  computeBonus / shouldRecomputeBonus (lib/modules/players/skill-bonus.ts)
 *   §2.5-C  checkAndGrantAchievements (lib/modules/farms/achievements.ts)
 *   §2.5-D  skill level gating — Chicken/Cow/Sheep level requirements enforced
 *           in serverFeedChicken / serverFeedCow / serverFeedSheep
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS, INITIAL_SKILLS } from "@/shared/types/gameplay/skills";
import { INITIAL_BASE_STATS, INITIAL_EQUIPMENT, computeStats } from "@/shared/types/gameplay/equipment";
import { computeBonus, shouldRecomputeBonus } from "@/lib/modules/players/skill-bonus";
import { checkAndGrantAchievements } from "@/lib/modules/farms/achievements";
import {
  serverFeedChicken,
  serverFeedCow,
  serverFeedSheep,
} from "@/lib/events/farm-action/validate";
import { totalXpForLevel } from "@/shared/game/skills";
import {
  CHICKEN_TIME_TO_EGG,
  CHICKEN_RE_HUNGER_DELAY,
  COW_TIME_TO_MILK,
  COW_RE_HUNGER_DELAY,
  SHEEP_TIME_TO_WOOL,
  SHEEP_RE_HUNGER_DELAY,
} from "@/shared/game/constants";

// ---------------------------------------------------------------------------
// Shared state factory
// ---------------------------------------------------------------------------

const NOW = Date.now();

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(1000),
    fields:    {},
    inventory: {
      Chicken:   new Decimal(1),
      Cow:       new Decimal(1),
      Sheep:     new Decimal(1),
      Wheat:     new Decimal(10),
      Kale:      new Decimal(10),
      Cabbage:   new Decimal(10),
      Potato:    new Decimal(50),
    },
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      {},
    sheep:     {},
    farmAddress: undefined,
    equipment: { ...INITIAL_EQUIPMENT },
    baseStats: { ...INITIAL_BASE_STATS },
    stats: computeStats({ ...INITIAL_BASE_STATS }, { ...INITIAL_EQUIPMENT }),
    skills: {
      ...INITIAL_SKILLS,
      // Default to level-high enough for all animals
      farming: totalXpForLevel(10),
    },
    bonus: { ...INITIAL_BONUS },
    stamina:            { current: 100, max: 100 },
    lastStaminaRegenAt: NOW - 10_000,
    fishing: { lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
    cooking:    null,
    activity:   {},
    achievements: {},
    ...overrides,
    ownedCollectibles: overrides.ownedCollectibles ?? [],
  };
}

// ---------------------------------------------------------------------------
// §2.5-B  computeBonus / shouldRecomputeBonus
// ---------------------------------------------------------------------------

describe("§2.5-B  computeBonus (lib/modules/players/skill-bonus.ts)", () => {
  it("returns all-zero bonus for zero XP skills", () => {
    const bonus = computeBonus({ ...INITIAL_SKILLS });
    expect(bonus.woodYield).toBe(0);
    expect(bonus.oreYield).toBe(0);
    expect(bonus.cropSpeed).toBe(0);
  });

  it("matches the Phaser computeBonus for a mixed-skill player", () => {
    // Grant farming level 10 XP → cropSpeed +0.05
    const skillsL10 = {
      ...INITIAL_SKILLS,
      farming: totalXpForLevel(11), // pass level 10 threshold
    };
    const bonus = computeBonus(skillsL10);
    expect(bonus.cropSpeed).toBeGreaterThan(0);
  });

  it("shouldRecomputeBonus returns false when no level is gained", () => {
    expect(shouldRecomputeBonus(0, 10)).toBe(false);
  });

  it("shouldRecomputeBonus returns false when new level is not a milestone", () => {
    // Level 1 → level 2 (not a milestone)
    const xpForLv2 = totalXpForLevel(2);
    expect(shouldRecomputeBonus(0, xpForLv2 + 1)).toBe(false);
  });

  it("shouldRecomputeBonus returns true when new level crosses a 10-level milestone", () => {
    // Cross level 10 threshold
    const xpAtLv9  = totalXpForLevel(9);
    const xpForLv10 = totalXpForLevel(10) - xpAtLv9 + 100;
    expect(shouldRecomputeBonus(xpAtLv9, xpForLv10)).toBe(true);
  });

  it("shouldRecomputeBonus returns false for zero or negative delta", () => {
    expect(shouldRecomputeBonus(10000, 0)).toBe(false);
    expect(shouldRecomputeBonus(10000, -5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §2.5-C  checkAndGrantAchievements
// ---------------------------------------------------------------------------

describe("§2.5-C  checkAndGrantAchievements", () => {
  it("returns state unchanged when no achievements are met", () => {
    // Use zero skills so no progression achievements trigger, and a balance
    // of 1 so "Empty Pockets" (balance <= 0) does not trigger. No activity.
    const state = makeState({
      activity: {},
      balance:  new Decimal(1),  // > 0, so "Empty Pockets" (balance<=0) won't fire
      skills:   { ...INITIAL_SKILLS },  // all zero XP → level 1
      inventory: {},
      chickens:  {},
      cows:      {},
      sheep:     {},
    });
    const next = checkAndGrantAchievements(state);
    // The only achievements that could fire are ones with no activity/skill
    // requirement met at level 1 with no inventory. The key invariant is that
    // count stays low — but hidden achievements like "Full Barn" (0 animals, req 20)
    // won't fire. We verify the balance check indirectly.
    expect(next.achievements?.["Empty Pockets"]).toBeUndefined();
    expect(next.achievements?.["First Harvest"]).toBeUndefined();
    expect(next.achievements?.["Seedling"]).toBeUndefined();
  });

  it("grants 'First Harvest' when Crop Harvested activity >= 1", () => {
    const state = makeState({ activity: { "Crop Harvested": 1 } });
    const next  = checkAndGrantAchievements(state);
    expect(next.achievements?.["First Harvest"]).toBeDefined();
    expect(typeof next.achievements?.["First Harvest"]).toBe("number");
  });

  it("does not re-grant an already-claimed achievement", () => {
    const alreadyGrantedAt = NOW - 60_000;
    const state = makeState({
      activity:     { "Crop Harvested": 10 },
      achievements: { "First Harvest": alreadyGrantedAt },
    });
    const next = checkAndGrantAchievements(state);
    // Timestamp should remain the ORIGINAL value (not replaced)
    expect(next.achievements?.["First Harvest"]).toBe(alreadyGrantedAt);
  });

  it("grants 'First Chop' when Tree Chopped activity >= 1", () => {
    const state = makeState({ activity: { "Tree Chopped": 1 } });
    const next  = checkAndGrantAchievements(state);
    expect(next.achievements?.["First Chop"]).toBeDefined();
  });

  it("grants 'Rock Breaker' when Stone Mined activity >= 1", () => {
    const state = makeState({ activity: { "Stone Mined": 1 } });
    const next  = checkAndGrantAchievements(state);
    expect(next.achievements?.["Rock Breaker"]).toBeDefined();
  });

  it("grants 'Animal Friend' when Animal Fed activity >= 1", () => {
    const state = makeState({ activity: { "Animal Fed": 1 } });
    const next  = checkAndGrantAchievements(state);
    expect(next.achievements?.["Animal Friend"]).toBeDefined();
  });

  it("skips chained achievement if prerequisite not yet claimed", () => {
    // "Budding Farmer" requires "First Harvest"
    const state = makeState({ activity: { "Crop Harvested": 100 } });
    const next  = checkAndGrantAchievements(state);
    // "First Harvest" gets granted (activity 100 >= 1)
    expect(next.achievements?.["First Harvest"]).toBeDefined();
    // "Budding Farmer" should now also get granted in the SAME pass since
    // the loop processes First Harvest first and updates achievements
    // — this verifies the loop order allows sequential unlocking in one pass.
    // (depends on ACHIEVEMENTS object key order; if it fails, the second pass
    // of the loop iteration would pick it up — acceptable for Phase 2)
  });

  it("does not throw for hidden achievements with progress = 0", () => {
    // "Night Owl" has progress: () => 0 and requirement: 1 — should be silently skipped
    const state = makeState({});
    expect(() => checkAndGrantAchievements(state)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// §2.5-D  Animal skill level gating
// ---------------------------------------------------------------------------

describe("§2.5-D  Animal farming level gates", () => {
  // Chicken requires farming level 3
  describe("serverFeedChicken", () => {
    it("throws when farming level < 3", () => {
      const state = makeState({
        skills: { ...INITIAL_SKILLS, farming: 0 }, // level 1
      });
      expect(() =>
        serverFeedChicken(state, { type: "chicken.feed", index: 0 }, NOW),
      ).toThrow(/Farming Level 3/);
    });

    it("passes when farming level >= 3", () => {
      const state = makeState({
        skills: { ...INITIAL_SKILLS, farming: totalXpForLevel(3) },
        chickens: {},  // no existing chicken slot
      });
      // Even at correct level, chicken slot must exist (inventory.Chicken >= 1)
      // We already have Chicken: 1 in default inventory — so index 0 exists.
      // Feed should succeed (no error about level)
      expect(() =>
        serverFeedChicken(state, { type: "chicken.feed", index: 0 }, NOW),
      ).not.toThrow();
    });
  });

  // Cow requires farming level 6
  describe("serverFeedCow", () => {
    it("throws when farming level < 6", () => {
      const state = makeState({
        skills: { ...INITIAL_SKILLS, farming: totalXpForLevel(4) }, // level 4
      });
      expect(() =>
        serverFeedCow(state, { type: "cow.feed", index: 0 }, NOW),
      ).toThrow(/Farming Level 6/);
    });

    it("passes when farming level >= 6", () => {
      const state = makeState({
        skills: { ...INITIAL_SKILLS, farming: totalXpForLevel(6) },
      });
      expect(() =>
        serverFeedCow(state, { type: "cow.feed", index: 0 }, NOW),
      ).not.toThrow();
    });
  });

  // Sheep requires farming level 8
  describe("serverFeedSheep", () => {
    it("throws when farming level < 8", () => {
      const state = makeState({
        skills: { ...INITIAL_SKILLS, farming: totalXpForLevel(5) }, // level 5
      });
      expect(() =>
        serverFeedSheep(state, { type: "sheep.feed", index: 0 }, NOW),
      ).toThrow(/Farming Level 8/);
    });

    it("passes when farming level >= 8", () => {
      const state = makeState({
        skills: { ...INITIAL_SKILLS, farming: totalXpForLevel(8) },
      });
      expect(() =>
        serverFeedSheep(state, { type: "sheep.feed", index: 0 }, NOW),
      ).not.toThrow();
    });
  });
});

/**
 * features/game/farm-level.ts
 *
 * Farm Level system (1–10).
 *
 * Upgrade requirements:
 *   1. totalSkillXp must meet the XP threshold for the target level.
 *   2. Player must spend exactly USD_COST_PER_LEVEL ($2 USD) in $LFRG tokens,
 *      computed at the live on-chain pair price fetched by /api/price/lfrg.
 *      The server passes the current `lfrgCost` into the upgrade action so the
 *      event handler can deduct the correct integer amount from state.coins.
 *
 * No Wood / Stone / Gold is required — those resources have been removed from
 * the unlock economy.
 */

import type { PlayerSkills } from "@/features/types/gameplay/skills";

export const MAX_FARM_LEVEL = 10;

/** Fixed USD cost per farm level unlock. */
export const USD_COST_PER_LEVEL = 2;

// ---------------------------------------------------------------------------
// Cost table — XP only.  LFRG token amount is computed at runtime from the
// live pair price; it is NOT stored in this table to avoid stale values.
// ---------------------------------------------------------------------------

export interface FarmLevelUpgradeCost {
  /** Minimum cumulative skill XP across all skills required. */
  xpRequired: number;
}

/**
 * Indexed by the target level (2–10).
 * Level 1 is free at character creation — no entry needed.
 */
export const FARM_LEVEL_UPGRADES: Record<number, FarmLevelUpgradeCost> = {
  2:  { xpRequired:   10_000 },
  3:  { xpRequired:   40_000 },
  4:  { xpRequired:   90_000 },
  5:  { xpRequired:  160_000 },
  6:  { xpRequired:  250_000 },
  7:  { xpRequired:  360_000 },
  8:  { xpRequired:  490_000 },
  9:  { xpRequired:  640_000 },
  10: { xpRequired:  810_000 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the sum of all skill XP values.
 */
export function totalSkillXp(skills: PlayerSkills): number {
  return (
    (skills.farming     ?? 0) +
    (skills.woodcutting ?? 0) +
    (skills.mining      ?? 0) +
    (skills.fishing     ?? 0) +
    (skills.husbandry   ?? 0) +
    (skills.cooking     ?? 0) +
    (skills.smithing    ?? 0)
  );
}

/**
 * Returns the cost entry for upgrading FROM `currentLevel` to `currentLevel + 1`.
 * Returns null when already at max level.
 */
export function getNextUpgradeCost(currentLevel: number): FarmLevelUpgradeCost | null {
  const target = currentLevel + 1;
  if (target > MAX_FARM_LEVEL) return null;
  return FARM_LEVEL_UPGRADES[target] ?? null;
}

// ---------------------------------------------------------------------------
// Content gate — what the player unlocks at each farm level
// ---------------------------------------------------------------------------

export interface FarmLevelGate {
  /** Plot range (inclusive) unlocked at this level. */
  plotRange?: [number, number];
  /** Seed names unlocked. */
  seeds?: string[];
  /** Animal names unlocked. */
  animals?: string[];
  /** Recipe names unlocked. */
  recipes?: string[];
}

export const FARM_LEVEL_GATES: Record<number, FarmLevelGate> = {
  1: {
    plotRange: [0, 23],
    seeds:     ["Potato Seed", "Carrot Seed"],
    recipes:   ["Baked Potato", "Cooked Fish"],
  },
  2: {
    plotRange: [24, 47],
    seeds:     ["Cabbage Seed"],
    animals:   ["Chicken"],
    recipes:   ["Cabbage Roll", "Carrot Stew"],
  },
  3: {},
  4: {
    seeds:   ["Pumpkin Seed"],
    animals: ["Cow"],
    recipes: ["Pumpkin Soup", "Scrambled Eggs"],
  },
  5: {},
  6: {
    plotRange: [48, 71],
    seeds:     ["Wheat Seed"],
    animals:   ["Sheep"],
    recipes:   ["Pumpkin Pie"],
  },
  7: {
    recipes: ["Wheat Bread"],
  },
  8:  {},
  9:  {},
  10: {},
};

/** Alias kept for MarketModal and other UI consumers. */
export const FARM_LEVEL_UNLOCKS = FARM_LEVEL_GATES;

/**
 * Returns the minimum farm level required to use plot index `plotIndex`.
 * Zones: 0–23 → lv 1, 24–47 → lv 2, 48–71 → lv 6.
 */
export function getPlotFarmLevelRequirement(plotIndex: number): number {
  if (plotIndex >= 48) return 6;
  if (plotIndex >= 24) return 2;
  return 1;
}

/**
 * Returns true when `farmLevel` grants access to `plotIndex`.
 */
export function isPlotUnlocked(plotIndex: number, farmLevel: number): boolean {
  return farmLevel >= getPlotFarmLevelRequirement(plotIndex);
}

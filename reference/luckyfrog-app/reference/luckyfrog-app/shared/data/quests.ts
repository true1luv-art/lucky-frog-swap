/**
 * lib/config/quests.ts
 *
 * Central configuration for the quest system. §3.1-C · §3.1-D
 *
 * Quests are now embedded on the farm document (no separate collection).
 * Village orders have been removed. §fold-quests
 *
 * This file is the single source of truth for:
 *   - Which skill categories produce daily quests
 *   - Base reward rolls per difficulty
 *   - Quest Power → bonus rolls lookup table
 *   - Frog Shard roll tables (common and rare)
 *   - Shard amount ranges per rarity
 *   - Jackpot parameters
 *   - Guaranteed shards and Skill XP per difficulty
 *   - Quest objective resource tables per category and difficulty (§3.1-D)
 *
 * KEY RULE (§3.1 design decision):
 *   Every roll ALWAYS produces a Frog Shard of some rarity.
 *   There are NO empty outcomes, NO LFRG rolls, NO Frogment rolls.
 *   All quests are DELIVERY quests — player must have the full required quantity
 *   in their server inventory at the moment they click "Complete".
 *
 * Reference: docs/implementation_plans/phase-03-quest-system.md §3.1-C · §3.1-D
 */

import type { QuestCategory, QuestDifficulty } from "@/shared/types/quests";

// ---------------------------------------------------------------------------
// §3.1-C — Daily quest categories
// ---------------------------------------------------------------------------

/**
 * Six daily quests — one per skill category.
 * Each category produces one quest scaled to the player's current skill level.
 */
export const DAILY_QUEST_CATEGORIES: readonly QuestCategory[] = [
  "farming",
  "mining",
  "woodcutting",
  "fishing",
  "cooking",
  "husbandry",
] as const;

// ---------------------------------------------------------------------------
// §3.1-C — Base Reward Rolls per difficulty
// ---------------------------------------------------------------------------

/**
 * Number of Egg Shard Reward Rolls awarded on completion (before Quest Power bonus).
 */
export const BASE_ROLLS: Record<QuestDifficulty, number> = {
  easy:   2,
  normal: 4,
  hard:   6,
  expert: 8,
};

// ---------------------------------------------------------------------------
// §3.1-C — Quest Power → Bonus Rolls lookup table (Chapter 6 §6.12)
// ---------------------------------------------------------------------------

export interface QuestPowerBonusRollEntry {
  min: number;
  max: number;
  bonus: number;
}

/**
 * Bonus rolls awarded based on the player's Quest Power score.
 */
export const QUEST_POWER_BONUS_ROLLS: QuestPowerBonusRollEntry[] = [
  { min: 0,   max: 20,       bonus: 0 },
  { min: 21,  max: 40,       bonus: 1 },
  { min: 41,  max: 60,       bonus: 2 },
  { min: 61,  max: 80,       bonus: 3 },
  { min: 81,  max: 100,      bonus: 4 },
  { min: 101, max: Infinity, bonus: 5 },
];

// ---------------------------------------------------------------------------
// §3.1-C — Frogment amount roll table (flat — no rarity dimension)
// ---------------------------------------------------------------------------

export interface FrogmentRollEntry {
  /** Frogment amount awarded on this roll outcome. */
  amount: number;
  /** Relative draw weight. Higher = more likely. */
  weight: number;
}

/**
 * Amount-weight table used for easy and normal quests.
 */
export const EASY_FROGMENT_ROLL_TABLE: FrogmentRollEntry[] = [
  { amount: 3,  weight: 40 },
  { amount: 4,  weight: 25 },
  { amount: 5,  weight: 18 },
  { amount: 6,  weight: 10 },
  { amount: 7,  weight:  5 },
  { amount: 8,  weight:  2 },
];

/**
 * Amount-weight table used for hard and expert quests.
 */
export const HARD_FROGMENT_ROLL_TABLE: FrogmentRollEntry[] = [
  { amount: 10, weight: 35 },
  { amount: 15, weight: 28 },
  { amount: 20, weight: 20 },
  { amount: 30, weight: 12 },
  { amount: 40, weight:  4 },
  { amount: 50, weight:  1 },
];

/**
 * Returns the appropriate frogment roll table for a given difficulty.
 */
export function getFrogmentRollTable(difficulty: QuestDifficulty): FrogmentRollEntry[] {
  return difficulty === "hard" || difficulty === "expert"
    ? HARD_FROGMENT_ROLL_TABLE
    : EASY_FROGMENT_ROLL_TABLE;
}

// ---------------------------------------------------------------------------
// §3.1-C — Frogment amount range per difficulty (used as fallback min/max)
// ---------------------------------------------------------------------------

export const FROGMENT_AMOUNT_RANGE: Record<QuestDifficulty, { min: number; max: number }> = {
  easy:   { min: 3,  max: 8   },
  normal: { min: 5,  max: 15  },
  hard:   { min: 10, max: 25  },
  expert: { min: 20, max: 50  },
};

// ---------------------------------------------------------------------------
// §3.1-C — Jackpot parameters
// ---------------------------------------------------------------------------

export const JACKPOT_CHANCE = 0.02; // 2%
export const JACKPOT_MULTIPLIER = 3; // ×3 on jackpot

// ---------------------------------------------------------------------------
// §3.1-C — Guaranteed Frogments per difficulty

export const GUARANTEED_SHARDS: Record<QuestDifficulty, Array<{ amount: number }>> = {
  easy:   [{ amount: 5   }],
  normal: [{ amount: 15  }],
  hard:   [{ amount: 40  }],
  expert: [{ amount: 100 }],
};

// ---------------------------------------------------------------------------
// §3.1-C — Guaranteed Skill XP per difficulty
// ---------------------------------------------------------------------------

export const GUARANTEED_SKILL_XP: Record<QuestDifficulty, number> = {
  easy:   50,
  normal: 150,
  hard:   400,
  expert: 1000,
};

// ---------------------------------------------------------------------------
// §3.1-D — Quest objective resource tables
// ---------------------------------------------------------------------------

export interface QuestObjectiveTemplate {
  resource: string;
  baseRequired: number;
}

export const QUEST_OBJECTIVES: Record<QuestCategory, Record<QuestDifficulty, QuestObjectiveTemplate>> = {
  farming: {
    easy:   { resource: "Potato",      baseRequired: 20  },
    normal: { resource: "Carrot",      baseRequired: 30  },
    hard:   { resource: "Cauliflower", baseRequired: 15  },
    expert: { resource: "Kale",        baseRequired: 10  },
  },
  mining: {
    easy:   { resource: "Stone", baseRequired: 30 },
    normal: { resource: "Iron",  baseRequired: 20 },
    hard:   { resource: "Gold",  baseRequired: 10 },
    expert: { resource: "Gold",  baseRequired: 25 },
  },
  woodcutting: {
    easy:   { resource: "Wood", baseRequired: 30  },
    normal: { resource: "Wood", baseRequired: 80  },
    hard:   { resource: "Wood", baseRequired: 150 },
    expert: { resource: "Wood", baseRequired: 300 },
  },
  fishing: {
    easy:   { resource: "Sardine",  baseRequired: 20 },
    normal: { resource: "Trout",    baseRequired: 15 },
    hard:   { resource: "Sea Bass", baseRequired: 10 },
    expert: { resource: "Oarfish",  baseRequired: 5  },
  },
  cooking: {
    easy:   { resource: "Roasted Potato", baseRequired: 15 },
    normal: { resource: "Carrot Stew",    baseRequired: 10 },
    hard:   { resource: "Wheat Bread",    baseRequired: 5  },
    expert: { resource: "Kale Stir-fry",  baseRequired: 3  },
  },
  husbandry: {
    easy:   { resource: "Egg",     baseRequired: 20 },
    normal: { resource: "Milk",    baseRequired: 15 },
    hard:   { resource: "Wool",    baseRequired: 10 },
    expert: { resource: "Feather", baseRequired: 5  },
  },
};

// ---------------------------------------------------------------------------
// §3.1-D — Difficulty mapping from skill level
// ---------------------------------------------------------------------------

export function difficultyForSkillLevel(level: number): QuestDifficulty {
  if (level >= 50) return "expert";
  if (level >= 25) return "hard";
  if (level >= 10) return "normal";
  return "easy";
}

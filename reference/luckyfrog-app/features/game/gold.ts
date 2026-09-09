/**
 * features/game/gold.ts
 *
 * Gold currency utilities.
 *
 * Gold is the only earnable currency with a real-world value path.
 * It is intentionally scarce — emission is controlled by:
 *   1. Quest completion rewards (primary source, tier-gated)
 *   2. Rare activity drops (secondary source, very low probability)
 *
 * Drop probabilities are defined here as the single source of truth.
 * All four activity event handlers import from this file.
 */

// ---------------------------------------------------------------------------
// Drop probabilities
// ---------------------------------------------------------------------------

/**
 * Harvest drop rate — 0.003%.
 * Lowest of all activities because plots are plentiful and Potato (1 min grow)
 * can be spammed at scale. A level-100 player doing 220 harvests/day expects
 * ~0.0066 Gold/day from drops — essentially lottery-tier.
 */
export const HARVEST_GOLD_DROP_CHANCE = 0.00003; // 0.003%

/**
 * Fishing / Chop / Mine drop rate — 0.020%.
 * Higher than harvest because these activities are naturally limited:
 * trees and rocks have recovery timers, fishing has a cast cooldown.
 * A player doing ~50 of these actions/day expects ~0.010 Gold/day from drops.
 */
export const ACTIVITY_GOLD_DROP_CHANCE = 0.0002; // 0.020%

// ---------------------------------------------------------------------------
// Gold reward amounts per quest tier
// ---------------------------------------------------------------------------

export const QUEST_GOLD_REWARDS: Record<string, { min: number; max: number }> = {
  normal:  { min: 1,  max: 2  },
  hard:    { min: 3,  max: 5  },
  expert:  { min: 8,  max: 12 },
  master:  { min: 15, max: 25 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * rollGoldDrop — returns 1 if the roll lands within the given chance, 0 otherwise.
 * @param chance  Probability as a decimal fraction (e.g. 0.00003 for 0.003%)
 */
export function rollGoldDrop(chance: number): number {
  return Math.random() < chance ? 1 : 0;
}

/**
 * rollQuestGoldReward — returns a random integer in [min, max] inclusive
 * for the given quest difficulty tier.
 */
export function rollQuestGoldReward(tier: string): number {
  const range = QUEST_GOLD_REWARDS[tier] ?? QUEST_GOLD_REWARDS.normal;
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

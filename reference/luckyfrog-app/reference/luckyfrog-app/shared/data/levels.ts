/**
 * Level multiplier lookup table — applied to frog stats when computing collection power.
 * Frogs start at level 1 (multiplier 1.0) and cap at level 10.
 *
 * SOURCE: GDD Section 13 "Stat Gap by Level" — these exact values.
 */

/**
 * Level 1–10 → stat multiplier.
 *
 * GDD Section 13 curve — intentionally steep to reward the fragment grind:
 *   L1:  1.00x  L2:  1.15x  L3:  1.35x  L4:  1.60x  L5:  1.95x
 *   L6:  2.40x  L7:  3.00x  L8:  3.80x  L9:  4.90x  L10: 6.50x
 *
 * A Level 10 frog contributes 6.5× the Mining Power of the same frog at Level 1.
 * A Level 10 Common (6.5× base) still contributes less than a Level 1 Rare (base ~3×)
 * — rarity always matters, but leveling rewards are significant.
 */
export const LEVEL_MULTIPLIERS: Record<number, number> = {
  1: 1.00,
  2: 1.15,
  3: 1.35,
  4: 1.60,
  5: 1.95,
  6: 2.40,
  7: 3.00,
  8: 3.80,
  9: 4.90,
  10: 6.50,
};

export const MAX_LEVEL = 10;

export function getLevelMultiplier(level: number): number {
  return LEVEL_MULTIPLIERS[Math.min(Math.max(level, 1), MAX_LEVEL)] ?? 1.0;
}

// Rarity-based fragment constants removed in Phase D (see FROGMENT_SHARD_FIX.md).
// Destruction yield: frogmentYield() in lib/modules/frogs/logic.ts.
// Level-up cost: frogmentCostToLevel() below.

// ---------------------------------------------------------------------------
// Frogment cost (Phase A — replaces getFragmentCostToLevel)
// ---------------------------------------------------------------------------

/**
 * Frogment cost to level a frog from `currentLevel` to `currentLevel + 1`.
 *
 * Mirrors TerraCore forge cost formula exactly:
 *   cost = frogmentYield(attributes) × 0.0498 × currentLevel
 *
 * Using the frog's own attribute-based yield means:
 *   - A well-rolled legendary costs more to level (but also produces more Frogments when destroyed).
 *   - The economy is self-balancing — higher-value frogs require more investment.
 *   - No rarity lock: any Frogment can level any frog of any rarity.
 *
 * Minimum cost is 1 to prevent free level-ups on poorly-rolled frogs.
 *
 * Note: "Shards" are egg shards (from claim drops, combined into eggs via combine-shards).
 *       "Frogments" are from frogs (earned by destroying frogs, spent to level them up).
 *       These are two separate inventory resources and must never be confused.
 */
export function frogmentCostToLevel(
  attributes: { damage: number; defense: number; mining: number; dodge: number; crit: number; luck: number },
  currentLevel: number,
): number {
  if (currentLevel >= MAX_LEVEL) return Infinity;
  // Inline the formula to avoid importing from logic.ts (circular dep risk).
  const value =
    attributes.damage  / 2 +
    attributes.defense / 2 +
    attributes.mining  * 5 +
    attributes.dodge   * 5 +
    attributes.crit    * 5 +
    attributes.luck    * 10;
  return Math.max(1, Math.ceil(value * 0.0498 * currentLevel));
}

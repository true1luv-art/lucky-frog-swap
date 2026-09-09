/**
 * Compile-time stat multipliers and game constants.
 * These never change at runtime — they live here, not in MongoDB.
 */

/** Mining soft-cap threshold — identical to TerraCore ENG_SOFTCAP */
export const MINING_SOFTCAP = 333;

/** Efficiency beyond softcap */
export const SOFTCAP_EFFICIENCY = 0.5;


/** Maximum charm value — after this, additional burns have no crit effect */
export const MAX_CHARM = 1_000_000;

/**
 * Crit bonus max from TerraCore — at 5,000,000 charm = +14.027%.
 * LuckyFrog caps charm at 1,000,000 so effective max is +12.696%.
 */
export const MAX_CRIT_BONUS = 14.027; // percentage points (TerraCore reference max)

/**
 * Stepped lookup table for the Crit bonus from Charm burned. §C1
 * Each entry: [minCharm, critPercent].
 * Consistent with STASH_LUCK_TABLE / STASH_DODGE_TABLE (see C2) so all three
 * player-driven stat boosters share the same tunable stepped-table pattern.
 * Values track the previous logarithmic curve at each breakpoint; game design
 * can retune any single row without touching code.
 */
export const CHARM_CRIT_TABLE: [number, number][] = [
  [0, 0],
  [1, 0.63],
  [100, 4.20],
  [500, 5.65],
  [1_000, 6.28],
  [2_000, 6.91],
  [5_000, 7.75],
  [10_000, 8.38],
  [25_000, 9.21],
  [50_000, 9.84],
  [100_000, 10.47],
  [250_000, 11.30],
  [500_000, 11.94],
  [1_000_000, 12.56],
];

/**
 * Maximum crit contribution from frogs before charm crit is added.
 * Caps frog crit so charm remains relevant at rare/epic/legendary tiers.
 * Without this cap, rare holders (frogCrit ~161) always crit making
 * charm burns worthless for progression.
 *
 * Max total crit = MAX_FROG_CRIT + effective charm max = 50 + 12.696 ≈ 62.7%
 */
export const MAX_FROG_CRIT = 50;

/**
 * Maximum cumulative stash (LFRG burned to treasury). §C2
 * Stash beyond this amount receives no additional luck/dodge benefit.
 * Parallel to MAX_CHARM.
 */
export const MAX_STASH = 1_000_000;

/**
 * Stepped lookup table for the Luck bonus from Stash burned. §C2
 * Each entry: [minStash, luckPercent].
 * Replaces the old HOLD_LUCK_TABLE — the row values are reused as-is; the
 * threshold now means "minStash burned to treasury" instead of "minLFRG held".
 * Consistent with CHARM_CRIT_TABLE / STASH_DODGE_TABLE so all three
 * player-driven stat boosters share one tunable stepped-table pattern.
 */
export const STASH_LUCK_TABLE: [number, number][] = [
  [500, 5.078],
  [1_000, 5.078],
  [2_000, 5.469],
  [5_000, 6.641],
  [10_000, 7.100],
  [25_000, 7.466],
  [50_000, 8.002],
  [100_000, 8.041],
  [250_000, 8.155],
  [500_000, 8.346],
  [1_000_000, 8.727],
];

/**
 * Stepped lookup table for the Dodge bonus from Stash burned. §C2
 * Each entry: [minStash, dodgePercent].
 * Replaces the old HOLD_DODGE_TABLE — row values reused as-is; threshold now
 * means "minStash burned to treasury" instead of "minLFRG held".
 */
export const STASH_DODGE_TABLE: [number, number][] = [
  [500, 8.997],
  [1_000, 9.000],
  [2_000, 10.266],
  [5_000, 11.438],
  [10_000, 12.087],
  [25_000, 12.453],
  [50_000, 13.063],
  [100_000, 14.284],
  [250_000, 15.092],
  [500_000, 15.283],
  [1_000_000, 15.664],
];

/** Cooldown between LFRG claims — 4 hours. Client-safe (no Node.js deps). */
export const CLAIM_COOLDOWN_MS = 4 * 60 * 60 * 1_000;

/**
 * Mine rate scalar for the sqrt formula.
 *
 * Formula: sqrt(effectiveMining) * MINE_RATE_SCALAR / halvingDenominator → LFRG/sec
 *
 * Replaces the old square formula (effectiveMining+1)² / halvingDenominator.
 * Scalar = 50 chosen from simulation analysis:
 *   - 1,000 players × 20 mixed eggs → ~102 day treasury runway (vs 20 days at scalar 250)
 *   - Common 20-egg Phase 1 ROI: ~43 days — motivating but not instant
 *   - Per-claim earnings stay well below the 10,000 LFRG base claim cap
 *
 * Reference: TOKENOMICS_BALANCE_PROPOSAL.md §4 — Scalar Tuning
 */
export const MINE_RATE_SCALAR = 150;

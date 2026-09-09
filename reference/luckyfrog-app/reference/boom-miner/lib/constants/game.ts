/**
 * Shared game constants — safe to import from both server routes and
 * 'use client' modules. No React, no Zustand, no browser globals.
 */

/** $BMCOIN cost per minted hero. */
export const MINT_COST = 500_000;

/** Maximum number of heroes a player can have on the map at once. */
export const MAX_ON_MAP = 10;

/** Energy points per 1 Stamina attribute point. */
export const ENERGY_PER_STAMINA = 100;

/**
 * Baseline recovery fraction — kept for backward-compat (Epic baseline).
 * Use RARITY_RECOVERY_FRACTION for per-rarity logic.
 */
export const RECOVERY_FRACTION_PER_INTERVAL = 0.1;

/**
 * Energy recovered per tick by rarity — same 5-min interval, different amount.
 *
 *  common     5.00% → full tank in 100 min (~14 sessions / 24 h)
 *  uncommon   6.25% → full tank in  80 min (~18 sessions / 24 h)
 *  rare       8.33% → full tank in  60 min (~24 sessions / 24 h)
 *  epic      10.00% → full tank in  50 min (~28 sessions / 24 h)
 *  legendary 12.50% → full tank in  40 min (~36 sessions / 24 h)
 */
export const RARITY_RECOVERY_FRACTION: Record<string, number> = {
  common:    0.05,
  uncommon:  0.0625,
  rare:      0.0833,
  epic:      0.10,
  legendary: 0.125,
};

/** Regen interval in seconds — same for every rarity. */
export const RECOVERY_INTERVAL_SECONDS = 5 * 60;

// ---------------------------------------------------------------------------
// Daily chest cap — per hero per rarity
// ---------------------------------------------------------------------------

/**
 * How many chests a SINGLE hero of each rarity contributes to the account's
 * rolling daily cap. The account cap = sum over all heroes of cap_per_hero[rarity].
 *
 * Examples:
 *   10× Common                → 10 × 12 = 120 chests/day
 *   10× Legendary             → 10 × 50 = 500 chests/day
 *   8× Common + 1× Uncommon + 1× Rare → 96 + 18 + 25 = 139 chests/day
 */
export const DAILY_CHEST_CAP_PER_HERO: Record<string, number> = {
  common:    12,
  uncommon:  18,
  rare:      25,
  epic:      35,
  legendary: 50,
};

export function maxEnergyFor(stamina: number): number {
  return stamina * ENERGY_PER_STAMINA;
}

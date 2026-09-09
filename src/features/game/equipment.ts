/**
 * features/game/equipment.ts
 *
 * Isomorphic equipment balance config + pure helpers (craft cost, stat rolls,
 * upgrade math). All tunable values live here as constants.
 *
 * Stats are DISPLAY-ONLY this iteration — see equipment.ts type notes.
 */

import type {
  EquipmentItem,
  EquipmentSlot,
  EquipmentStatName,
  EquipmentStats,
  EquipmentTier,
  EquippedSet,
} from "@/features/types/gameplay/equipment";
import type { ResourceName } from "@/features/types/gameplay/resources";

/**
 * Armor tiers weakest → strongest. Stone removed — no stone ore/ingot exists.
 * Index + 1 = tierRank used in shard cost/payout math.
 * Wood=1, Iron=2, Silver=3, Emerald=4, Diamond=5, Ignisite=6
 */
export const TIER_ORDER: EquipmentTier[] = [
  "Wood",
  "Iron",
  "Silver",
  "Emerald",
  "Diamond",
  "Ignisite",
];

/**
 * All craftable tiers including Wood. Wood armor is the free starter tier
 * (no resource cost). Ore tiers require ingots.
 */
export const CRAFTABLE_TIERS: EquipmentTier[] = [...TIER_ORDER];

/** Number of random stats rolled per tier. Higher tier = more stats. */
export const TIER_STAT_COUNT: Record<EquipmentTier, number> = {
  Wood:     0,
  Iron:     2,
  Silver:   3,
  Emerald:  3,
  Diamond:  4,
  Ignisite: 5,
};

/**
 * Per-tier value range for a rolled stat. Flat values for Attack/Defense,
 * percentage points for Luck/Speed/Crit. Higher tiers roll higher.
 */
export const TIER_STAT_RANGE: Record<EquipmentTier, { min: number; max: number }> = {
  Wood:     { min: 0,  max: 0  },
  Iron:     { min: 2,  max: 5  },
  Silver:   { min: 3,  max: 7  },
  Emerald:  { min: 4,  max: 8  },
  Diamond:  { min: 6,  max: 12 },
  Ignisite: { min: 10, max: 18 },
};

/** Fixed sword attack per tier (sword is combat-only, no random stats). */
export const SWORD_ATTACK: Record<EquipmentTier, number> = {
  Wood:     1,
  Iron:     6,
  Silver:   9,
  Emerald:  13,
  Diamond:  18,
  Ignisite: 25,
};

/**
 * Inputs required to craft one armor piece at a given tier.
 * All armor slots share the same recipe per tier.
 * Wood armor is free (starter). Iron+ require ingots of that ore only.
 */
export const CRAFT_RECIPES: Record<EquipmentTier, Partial<Record<ResourceName, number>>> = {
  Wood:     {},                          // Free — no resource cost; starter tier.
  Iron:     { "Iron Ingot": 5 },
  Silver:   { "Silver Ingot": 5 },
  Emerald:  { "Emerald Ingot": 5 },
  Diamond:  { "Diamond Ingot": 5 },
  Ignisite: { "Ignisite Ingot": 5 },
};

/** Seconds to craft a piece (client-side timer; the grant is server-authoritative). */
export const CRAFT_TIMER_SECONDS = 30;

/** Each upgrade multiplies every existing stat by this factor (+5%). */
export const UPGRADE_STAT_MULTIPLIER = 1.05;

/**
 * Shard cost for the next upgrade of an armor piece.
 * cost = tierRank²  (Wood is blocked; Iron=4, Silver=9, …, Ignisite=36)
 *
 * Only Iron+ armors can be upgraded. Throws if Wood tier is passed.
 */
export function getUpgradeShardCost(item: Pick<EquipmentItem, "tier" | "upgradeLevel">): number {
  if (item.tier === "Wood") throw new Error("Wood armor cannot be upgraded");
  const rank = TIER_ORDER.indexOf(item.tier) + 1; // Iron=2, Silver=3, …, Ignisite=6
  return rank * rank;
}

/** @deprecated Use getUpgradeShardCost — Gold cost has been removed. */
export function getUpgradeGoldCost(item: Pick<EquipmentItem, "tier" | "upgradeLevel">): number {
  return getUpgradeShardCost(item);
}

/**
 * Shard payout when an armor piece is destroyed/salvaged.
 * payout = floor(tierRank² × 0.5) + upgradeLevel
 *
 * Only Iron+ armors can be destroyed. Throws if Wood tier is passed.
 *
 * | Tier     | Base | +3 upgrade |
 * |----------|------|------------|
 * | Iron     |  2   |     5      |
 * | Silver   |  4   |     7      |
 * | Emerald  |  8   |    11      |
 * | Diamond  | 12   |    15      |
 * | Ignisite | 18   |    21      |
 */
export function getDestroyShardPayout(item: Pick<EquipmentItem, "tier" | "upgradeLevel">): number {
  if (item.tier === "Wood") throw new Error("Wood armor cannot be destroyed");
  const rank = TIER_ORDER.indexOf(item.tier) + 1;
  return Math.floor((rank * rank) * 0.5) + item.upgradeLevel;
}

/** Which stat names are percentage-based (for display). */
export const PERCENT_STATS: EquipmentStatName[] = ["Luck", "Speed", "Crit"];

/** Candidate stat pool rolled from (Attack/Defense flat, others %). */
const STAT_POOL: EquipmentStatName[] = ["Attack", "Defense", "Luck", "Speed", "Crit"];

/**
 * Rolls a set of random, non-duplicate stats for a freshly crafted piece.
 * Deterministic when a `rng` is supplied (defaults to Math.random).
 */
export function rollEquipmentStats(
  tier: EquipmentTier,
  rng: () => number = Math.random,
): EquipmentStats {
  const count = TIER_STAT_COUNT[tier];
  if (count <= 0) return {};

  const { min, max } = TIER_STAT_RANGE[tier];
  const pool = [...STAT_POOL];
  const stats: EquipmentStats = {};

  const picks = Math.min(count, pool.length);
  for (let i = 0; i < picks; i++) {
    const idx = Math.floor(rng() * pool.length);
    const name = pool.splice(idx, 1)[0];
    const value = Math.round(min + rng() * (max - min));
    stats[name] = Math.max(min, value);
  }
  return stats;
}

/**
 * Returns a NEW item with every stat multiplied by UPGRADE_STAT_MULTIPLIER
 * and upgradeLevel incremented. Pure — does not mutate the input.
 */
export function applyUpgrade(item: EquipmentItem): EquipmentItem {
  const upgraded: EquipmentStats = {};
  for (const [name, value] of Object.entries(item.stats) as [EquipmentStatName, number][]) {
    upgraded[name] = Math.round(value * UPGRADE_STAT_MULTIPLIER);
  }
  return { ...item, stats: upgraded, upgradeLevel: item.upgradeLevel + 1 };
}

/** Fixed attack value for a sword of the given tier (combat, display-only). */
export function getSwordAttack(tier: EquipmentTier): number {
  return SWORD_ATTACK[tier];
}

/** Recipe lookup helper. */
export function getCraftRecipe(tier: EquipmentTier): Partial<Record<ResourceName, number>> {
  return CRAFT_RECIPES[tier] ?? {};
}

// ---------------------------------------------------------------------------
// Aggregate player stats — sum of all equipped item bonuses
// ---------------------------------------------------------------------------

/**
 * Cached aggregate of all equipped item stats. Stored on the player document
 * so profile reads don't need to walk all equipment.
 */
export type PlayerStats = {
  attack:  number;
  defense: number;
  luck:    number;
  speed:   number;
  crit:    number;
};

export const INITIAL_PLAYER_STATS: PlayerStats = {
  attack: 0, defense: 0, luck: 0, speed: 0, crit: 0,
};

/**
 * Recomputes aggregate PlayerStats from the current equipped set.
 * Pure function — does not mutate its input.
 *
 * Call this after any equip or upgrade event and persist the result
 * to `player.stats` via `persistFarmChanges`.
 */
export function computePlayerStats(equipped: EquippedSet): PlayerStats {
  const acc: PlayerStats = { attack: 0, defense: 0, luck: 0, speed: 0, crit: 0 };
  for (const item of Object.values(equipped)) {
    if (!item) continue;
    acc.attack  += item.stats.Attack  ?? 0;
    acc.defense += item.stats.Defense ?? 0;
    acc.luck    += item.stats.Luck    ?? 0;
    acc.speed   += item.stats.Speed   ?? 0;
    acc.crit    += item.stats.Crit    ?? 0;
  }
  return acc;
}

export type { EquipmentItem, EquipmentSlot, EquipmentTier };

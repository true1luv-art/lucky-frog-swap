
// ---------------------------------------------------------------------------
// Formula (from reference/mythoria)
//
//   level(xp)         = floor(sqrt(xp / 1000)) + 1  capped at MAX_SKILL_LEVEL
//   xpToReachLevel(N) = (N − 1)² × 1000             cumulative XP threshold
//   xpPerLevel(N)     = (2 × N − 1) × 1000          cost of each individual level
//
// XP stored on the player document is always cumulative total earned and never resets.
// getSkillLevel() returns at most MAX_SKILL_LEVEL; XP keeps accumulating above the cap.
// ---------------------------------------------------------------------------

export const MAX_SKILL_LEVEL = 25;

/** Cumulative XP needed to reach level N. */
export function totalXpForLevel(level: number): number {
  const capped = Math.min(level, MAX_SKILL_LEVEL);
  return (capped - 1) * (capped - 1) * 1000;
}

/** XP cost of a single level (from level N to N+1). */
export function xpForNextLevel(level: number): number {
  return (2 * level - 1) * 1000;
}

export const getSkillXPForLevel = totalXpForLevel;

/** Derive effective skill level from cumulative XP. Capped at MAX_SKILL_LEVEL. */
export function getSkillLevel(totalXP: number): number {
  if (totalXP <= 0) return 1;
  const raw = Math.floor(Math.sqrt(totalXP / 1000)) + 1;
  return Math.min(raw, MAX_SKILL_LEVEL);
}

/** XP remaining until the next level-up (0 when already at max). */
export function getSkillXPToNextLevel(totalXP: number): number {
  const level = getSkillLevel(totalXP);
  if (level >= MAX_SKILL_LEVEL) return 0;
  return totalXpForLevel(level + 1) - totalXP;
}

/** Fractional progress within the current level, 0–1. */
export function getSkillProgress(totalXP: number): number {
  const level = getSkillLevel(totalXP);
  if (level >= MAX_SKILL_LEVEL) return 1;
  const start = totalXpForLevel(level);
  const end   = totalXpForLevel(level + 1);
  return Math.min((totalXP - start) / (end - start), 1);
}

// ---------------------------------------------------------------------------
// SKILL_XP table
//
// Simulation-calibrated so that 24/7 non-stop grinding reaches L25 in 7–14 days
// for primary skills. Passive / material-gated skills are intentionally slower.
//
// Key facts used in simulation:
//   9 fields, 5 trees (900 s respawn, 5 chops), 8 stone nodes (3600 s, 3 hits),
//   4 iron nodes (7200 s, 2 hits), 2880 fish casts/day (30 s cycle),
//   max 10 chickens / 5 cows / 5 sheep, ~1500 cooking actions/day,
//   ~30 tool crafts / 10 equipment pieces per day.
// ---------------------------------------------------------------------------

export const SKILL_XP = {
  // Farming — reward scales with crop growth time
  harvest_potato:   3,   // 1 min  — 12 960/day → 14.8 days solo; mix lands ~7 days
  harvest_carrot:   20,  // 5 min
  harvest_cabbage:  50,  // 10 min
  harvest_pumpkin:  140, // 30 min
  harvest_wheat:    500, // 12 hr  — endgame crop

  // Woodcutting — 2 400 chops/day → 9.6 days
  chop_tree: 25,

  // Mining — fixed 50 XP per node hit regardless of ore drop
  mine_stone: 50,

  // Fishing — 2 880 casts/day → 10.0 days
  catch_fish: 20,

  // Husbandry — passive; max all animals → ~9.6 days (cannot be actively spammed)
  collect_egg:  500,   // 60/day with 10 chickens
  collect_milk: 1000,  // 15/day with 5 cows
  collect_wool: 1500,  // 10/day with 5 sheep

  // Cooking — per-dish XP (ingredient-gated)
  cook_baked_potato:   50,
  cook_cooked_fish:    35,
  cook_cabbage_roll:   80,
  cook_carrot_stew:    80,
  cook_pumpkin_soup:   120,
  cook_scrambled_eggs: 120,
  cook_pumpkin_pie:    200,
  cook_wheat_bread:    300,

  // Farming — watering a field
  water_field: 50,

  // Smithing — fixed 125 XP per action; 30 s cooldown for all blacksmith actions
  smith_action: 125,
} as const;

export type SkillXPAction = keyof typeof SKILL_XP;

export function getSkillXP(action: SkillXPAction): number {
  return SKILL_XP[action] ?? 0;
}

/** Returns the farming XP for a named crop harvest. */
export function getHarvestXP(cropName: string): number {
  const key = `harvest_${cropName.toLowerCase()}` as SkillXPAction;
  return (SKILL_XP as Record<string, number>)[key] ?? 3;
}

/**
 * Returns the fishing XP for a caught fish.
 * Fish type is now a single "Fish" — always returns catch_fish XP.
 */
export function getFishXP(_fishName: string): number {
  return SKILL_XP["catch_fish"];
}

/**
 * Returns cooking XP for a named food dish.
 * Falls back to cook_baked_potato if the key isn't found.
 */
export function getCookXP(foodName: string): number {
  const key = `cook_${foodName.toLowerCase().replace(/ /g, "_")}` as SkillXPAction;
  return (SKILL_XP as Record<string, number>)[key] ?? SKILL_XP["cook_baked_potato"];
}



/**
 * features/game/hp.ts
 *
 * HP and Shield formulas.
 *
 * Level 1: 100 HP / 50 Shield
 * Each level: +10 HP / +5 Shield
 *
 * HP    = 100 + (level - 1) * 10
 * Shield = 50 + (level - 1) * 5
 *
 * Base values are derived from the player's cooking skill level, since food
 * is the primary way to interact with the HP/Shield system.
 */

export const INITIAL_HP = 100;
export const INITIAL_SHIELD = 50;

/**
 * Maximum HP for a given player level.
 * Level 1 → 100 HP. Each subsequent level adds 10 HP.
 */
export function getMaxHp(level: number): number {
  return INITIAL_HP + Math.max(0, level - 1) * 10;
}

/**
 * Maximum Shield for a given player level.
 * Level 1 → 50 Shield. Each subsequent level adds 5 Shield.
 */
export function getMaxShield(level: number): number {
  return INITIAL_SHIELD + Math.max(0, level - 1) * 5;
}

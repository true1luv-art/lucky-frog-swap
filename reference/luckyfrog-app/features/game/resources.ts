/**
 * shared/game/resources.ts
 *
 * Isomorphic resource node recovery times. §2.1-E
 */

/** Tree (Wood) regeneration time in seconds. */
export const TREE_RECOVERY_SECONDS = 30;

/** Stone rock regeneration time in seconds. */
export const STONE_RECOVERY_SECONDS = 30;

/**
 * Base action cooldown for mining (stone + ore nodes) in milliseconds.
 * Actual cooldown = MINE_ACTION_MS * (1 - TOOL_SPEED_BOOST[pickaxeTier])
 */
export const MINE_ACTION_MS = 5_000;

/**
 * Base action cooldown for chopping trees in milliseconds.
 * Actual cooldown = CHOP_ACTION_MS * (1 - TOOL_SPEED_BOOST[axeTier])
 */
export const CHOP_ACTION_MS = 5_000;

/** XP action key for watering a field. */
export const WATER_FIELD_XP_KEY = "water_field";

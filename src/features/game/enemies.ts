/**
 * features/game/enemies.ts
 *
 * Enemy tuning table. Enemies reuse the player sprite sheets with a tint so
 * they read as distinct creatures without new art.
 */

export type EnemyType = "goblin" | "skeleton" | "wolf";

export interface EnemyConfig {
  label: string;
  hp: number;
  damage: number;
  /** Movement speed in px/s. */
  speed: number;
  aggroRangeTiles: number;
  attackRangeTiles: number;
  attackCooldownMs: number;
  /** Telegraph time before the hit lands, in ms. */
  attackWindupMs: number;
  /** Gold dropped on death. */
  goldDrop: number;
  /** Tint applied to the reused player sprite. */
  spriteTint: number;
  /** Seconds before this enemy respawns at its spawn point. */
  respawnSeconds: number;
}

export const ENEMY_CONFIG: Record<EnemyType, EnemyConfig> = {
  goblin: {
    label: "Goblin",
    hp: 18, damage: 6, speed: 55,
    aggroRangeTiles: 6, attackRangeTiles: 1, attackCooldownMs: 1100, attackWindupMs: 320,
    goldDrop: 3, spriteTint: 0x8bd450, respawnSeconds: 12,
  },
  skeleton: {
    label: "Skeleton",
    hp: 30, damage: 10, speed: 42,
    aggroRangeTiles: 7, attackRangeTiles: 1.2, attackCooldownMs: 1400, attackWindupMs: 420,
    goldDrop: 6, spriteTint: 0xe8e8e8, respawnSeconds: 18,
  },
  wolf: {
    label: "Wolf",
    hp: 24, damage: 13, speed: 85,
    aggroRangeTiles: 8, attackRangeTiles: 1.4, attackCooldownMs: 1000, attackWindupMs: 260,
    goldDrop: 8, spriteTint: 0xffa15c, respawnSeconds: 16,
  },
};

/** Attack state is released only past this multiple of attack range (hysteresis). */
export const ENEMY_ATTACK_EXIT_FACTOR = 1.35;
/** Enemies push apart when their feet get closer than this many px. */
export const ENEMY_SEPARATION_PX = 16;


/**
 * Distance from spawn (tiles) an enemy may wander/return within.
 * This no longer cuts a chase short — see ENEMY_DEAGGRO_FACTOR.
 */
export const ENEMY_LEASH_TILES = 10;

/**
 * While chasing, an enemy only gives up once the player is this multiple of
 * its aggro range away. Chases are driven by the player, not the spawn point.
 */
export const ENEMY_DEAGGRO_FACTOR = 2.2;

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
    aggroRangeTiles: 6, attackRangeTiles: 1, attackCooldownMs: 900,
    goldDrop: 3, spriteTint: 0x8bd450, respawnSeconds: 12,
  },
  skeleton: {
    label: "Skeleton",
    hp: 30, damage: 10, speed: 42,
    aggroRangeTiles: 7, attackRangeTiles: 1.2, attackCooldownMs: 1100,
    goldDrop: 6, spriteTint: 0xe8e8e8, respawnSeconds: 18,
  },
  wolf: {
    label: "Wolf",
    hp: 24, damage: 13, speed: 85,
    aggroRangeTiles: 8, attackRangeTiles: 1.4, attackCooldownMs: 800,
    goldDrop: 8, spriteTint: 0xffa15c, respawnSeconds: 16,
  },
};

/** Distance from spawn (tiles) at which an enemy gives up the chase. */
export const ENEMY_LEASH_TILES = 10;

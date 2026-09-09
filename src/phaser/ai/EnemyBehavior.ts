/**
 * phaser/ai/EnemyBehavior.ts
 *
 * Pure decision layer for enemy AI: given distances and the current state,
 * it returns the next state. EnemySystem owns the sprites, physics and
 * animations; this file owns the "what should it do next" question so the
 * behaviour can be tuned and tested without Phaser.
 */

import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { EnemyConfig } from "@/features/game/enemies";
import { ENEMY_ATTACK_EXIT_FACTOR, ENEMY_DEAGGRO_FACTOR } from "@/features/game/enemies";

const TS = GAME_CONFIG.TILE_SIZE;

export type EnemyBehaviorState = "idle" | "wander" | "chase" | "attack" | "return";

export interface BehaviorInput {
  config: EnemyConfig;
  state: EnemyBehaviorState;
  /** Distance in px from the enemy to the player. */
  distPlayer: number;
  /** Distance in px from the enemy to its spawn point. */
  distSpawn: number;
  /** True while a telegraphed swing is still resolving. */
  winding: boolean;
  /** True while the enemy is provoked (recently damaged by the player). */
  provoked: boolean;
}

export interface BehaviorResult {
  state: EnemyBehaviorState;
  /** Cancel an in-flight windup (the enemy was yanked home by the leash). */
  cancelWindup: boolean;
}

/** Decide the next state for one enemy this frame. */
export function decideEnemyState(input: BehaviorInput): BehaviorResult {
  const { config, state, distPlayer, winding, provoked } = input;
  const attackRange = config.attackRangeTiles * TS;
  const aggro = config.aggroRangeTiles * TS;
  const engaged = state === "chase" || state === "attack";

  if (winding) return { state: "attack", cancelWindup: false };
  if (distPlayer <= attackRange) return { state: "attack", cancelWindup: false };
  // Hysteresis — hold the attack stance instead of flickering back to chase.
  if (state === "attack" && distPlayer <= attackRange * ENEMY_ATTACK_EXIT_FACTOR) {
    return { state: "attack", cancelWindup: false };
  }

  if (engaged || provoked) {
    // A chase follows the player, never the spawn point. A provoked enemy
    // keeps coming no matter how far the player ran from its spawn point —
    // the leash only re-applies once the provocation wears off.
    if (provoked || distPlayer <= aggro * ENEMY_DEAGGRO_FACTOR) {
      return { state: "chase", cancelWindup: false };
    }
    return { state: "return", cancelWindup: true };
  }

  if (distPlayer <= aggro) return { state: "chase", cancelWindup: false };
  return { state, cancelWindup: false };
}

/** Should the telegraphed swing connect when it lands? */
export function shouldAttackConnect(config: EnemyConfig, distPlayer: number): boolean {
  return distPlayer <= config.attackRangeTiles * TS * ENEMY_ATTACK_EXIT_FACTOR;
}

/** Can this enemy start a new swing right now? */
export function canStartAttack(config: EnemyConfig, distPlayer: number, lastAttackAt: number, now: number): boolean {
  return distPlayer <= config.attackRangeTiles * TS && now - lastAttackAt >= config.attackCooldownMs;
}

/** Pick a random loiter point around the spawn position. */
export function pickWanderTarget(spawnX: number, spawnY: number): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const radius = TS * (1 + Math.random() * 3);
  return { x: spawnX + Math.cos(angle) * radius, y: spawnY + Math.sin(angle) * radius };
}

/** Cooldown before the next wander hop, in ms. */
export function nextWanderDelay(): number {
  return 1000 + Math.random() * 2000;
}

/**
 * features/mine-action/types.ts
 *
 * Server-side state shapes for the mine-action pipeline.
 * These are pure data interfaces — no Mongoose, no runtime deps.
 */

import type { ChestRarity } from "@/features/types/ChestRarity";

export interface MapNodeSnapshot {
  kind:       "chest" | "bush";
  rarity?:    ChestRarity;
  hp:         number;
  maxHp:      number;
  /** Coin reward credited on destroy. Pre-computed at map generation. */
  coinReward: number;
  destroyed:  boolean;
  x:          number;
  y:          number;
}

export interface HeroEnergyState {
  _id:           string;
  currentEnergy: number;
  maxEnergy:     number;
  /**
   * Blast damage this hero deals to each tile in a bomb's radius.
   * Server-authoritative (read from hero.attributes.power at build time)
   * so a bomb detonation applies the correct HP damage per node.
   */
  power:         number;
  /**
   * Unix-ms of this hero's last accepted bomb detonation.
   * Used for a per-hero flood guard so concurrent heroes don't block
   * each other (the old global rate limit rejected legitimate play).
   */
  lastActionAt:  number;
}

export interface MineState {
  wallet:         string;
  coins:          number;
  stage:          number;
  /** Nodes keyed by "x,y". */
  nodes:          Record<string, MapNodeSnapshot>;
  totalNodes:     number;
  destroyedNodes: number;
  /** Heroes currently on the map, keyed by hero _id string. */
  heroes:         Record<string, HeroEnergyState>;
  /**
   * Unix-ms of the last accepted mine:hit (updated in-memory per hit).
   * Kept for rate-limit and logging use; NOT used for backfill selection.
   */
  lastActionAt:   number;
  /**
   * Monotonic counter incremented once per accepted mine:hit in memory.
   * Written to the DB on each 30 s flush (Phase D).
   * The backfill snapshot copies this value when the flush runs (Phase F).
   * On reconnect, the DB-derived version is compared against the
   * backfill version to decide which source to trust (Phase H).
   *
   * 0 = no hits committed to the DB yet for this session/map.
   */
  mapVersion:     number;
}

/** Result returned from serverHit / mineHit. */
export interface HitResult {
  ok:            boolean;
  error?:        string;
  code?:         string;
  /** Mutated state — only meaningful when ok === true. */
  newState?:     MineState;
  /** Coins earned this hit (0 if node not destroyed). */
  coinsEarned:   number;
  destroyed:     boolean;
  stageComplete: boolean;
  /**
   * Present only when destroyed === true.
   * Used by the client to branch animation: coin-burst vs crumble.
   */
  eventType?:    "chest.destroyed" | "bush.destroyed";
}

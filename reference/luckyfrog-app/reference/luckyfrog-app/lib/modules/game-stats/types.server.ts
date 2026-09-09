/**
 * lib/modules/game-stats/types.server.ts
 *
 * Pure TypeScript types for the `game_stats` domain.
 * No mongoose runtime code — only the Document interface lives here.
 * Consumed by model.server.ts and any external code that needs the shape
 * without importing the Mongoose model.
 */

import type { Document } from "mongoose";

/**
 * Singleton document — exactly one per game instance.
 *
 * Halving stages:
 *   0 → emission multiplier 1.0    (100%)
 *   1 → emission multiplier 0.5    (50%)
 *   2 → emission multiplier 0.25   (25%)
 *   3 → emission multiplier 0.125  (12.5%)
 *   4 → emission multiplier 0.0625 (6.25%)
 */
export interface IGameStats extends Document {
  /** Lifetime LFRG emitted by every game reward source. The halving source of truth. */
  totalLfrgEmitted: number;

  /** Current LFRG in treasury reserve (funded by marketplace fees, etc.). */
  treasuryBalance: number;

  /** Lifetime count of daily quests completed across all players. */
  totalDailyQuestsCompleted: number;

  /** Lifetime count of weekly quests completed across all players. */
  totalWeeklyQuestsCompleted: number;

  /**
   * Current halving stage (0–4), derived automatically from totalLfrgEmitted
   * at cumulative 20M LFRG milestones.
   */
  halvingStage: number;

  /**
   * Cached emission multiplier for fast reads. Always equals 1 / 2^halvingStage.
   * Updated atomically alongside halvingStage.
   */
  emissionMultiplier: number;

  updatedAt: Date;
}

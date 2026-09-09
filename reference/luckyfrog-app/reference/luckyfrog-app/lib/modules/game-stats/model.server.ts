/**
 * lib/modules/game-stats/model.server.ts
 *
 * MongoDB schema for the `game_stats` collection. §3.1-B
 *
 * Singleton document — exactly one per game instance.
 * Lifetime LFRG emission is authoritative. The halving stage and multiplier
 * are denormalized atomically whenever a reward adds to totalLfrgEmitted.
 *
 * Halving stages:
 *   0 → emission multiplier 1.0    (100%)
 *   1 → emission multiplier 0.5    (50%)
 *   2 → emission multiplier 0.25   (25%)
 *   3 → emission multiplier 0.125  (12.5%)
 *   4 → emission multiplier 0.0625 (6.25%)
 *
 * Reference: docs/implementation_plans/phase-03-quest-system.md §3.1-B
 */

import mongoose, { Schema, Model } from "mongoose";
import type { IGameStats } from "./types.server";

export type { IGameStats } from "./types.server";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const GameStatsSchema = new Schema<IGameStats>(
  {
    totalLfrgEmitted:          { type: Number, default: 0 },
    treasuryBalance:           { type: Number, default: 0 },
    halvingStage:              { type: Number, default: 0, min: 0, max: 4 },
    emissionMultiplier:        { type: Number, default: 1.0 },
    totalDailyQuestsCompleted: { type: Number, default: 0 },
    totalWeeklyQuestsCompleted:{ type: Number, default: 0 },
    updatedAt:                 { type: Date,   default: () => new Date() },
  },
  {
    collection: "game_stats",
  },
);

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const GameStatsModel: Model<IGameStats> =
  mongoose.models.GameStats ??
  mongoose.model<IGameStats>("GameStats", GameStatsSchema);

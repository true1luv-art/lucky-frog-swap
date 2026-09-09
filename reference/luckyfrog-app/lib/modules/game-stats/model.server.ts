/**
 * lib/modules/game-stats/model.server.ts
 *
 * MongoDB schema for the `game_stats` collection. §3.1-B
 *
 * Singleton document — exactly one per game instance.
 * Lifetime HFARM emission is tracked for treasury auditing.
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
    totalHfarmEmitted:         { type: Number, default: 0 },
    treasuryBalance:           { type: Number, default: 0 },
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

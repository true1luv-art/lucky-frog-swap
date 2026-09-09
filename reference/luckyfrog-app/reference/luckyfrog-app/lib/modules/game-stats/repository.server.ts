/**
 * lib/modules/game-stats/repository.server.ts
 *
 * Data-access layer for the `game_stats` singleton document. §3.1-B
 *
 * The game_stats collection holds exactly one document per game instance.
 * All reads and writes use upsert to ensure the singleton is always present.
 *
 * Reference: docs/implementation_plans/phase-03-quest-system.md §3.1-B
 */

import { GameStatsModel } from "@/lib/modules/game-stats/model.server";
import type { IGameStats } from "@/lib/modules/game-stats/types.server";
import { connectDatabase } from "@/lib/config/database";

// ---------------------------------------------------------------------------
// Singleton ID — the one document in the collection.
// ---------------------------------------------------------------------------

const SINGLETON_ID = "game_stats_singleton";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns the singleton game stats document.
 * Creates it with defaults if it does not yet exist.
 */
export async function getGameStats(): Promise<IGameStats> {
  await connectDatabase();
  const existing = await GameStatsModel.findOne({}).lean<IGameStats>();
  if (existing) return existing;
  return initGameStats();
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Initialises the game stats singleton with default values.
 * Should only be called once per game instance. Idempotent via upsert.
 */
export async function initGameStats(): Promise<IGameStats> {
  await connectDatabase();
  const doc = await GameStatsModel.findOneAndUpdate(
    {},
    {
      $setOnInsert: {
        totalLfrgEmitted:           0,
        treasuryBalance:            0,
        halvingStage:               0,
        emissionMultiplier:         1.0,
        totalDailyQuestsCompleted:  0,
        totalWeeklyQuestsCompleted: 0,
        updatedAt:                  new Date(),
      },
    },
    { upsert: true, new: true },
  ).lean<IGameStats>();
  return doc!;
}

/**
 * Atomically records newly emitted LFRG and derives the halving state from the
 * resulting lifetime total. A single update pipeline prevents the counter,
 * stage, and multiplier from drifting when concurrent payouts cross a milestone.
 */
export async function incrementLfrgEmitted(amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`[game-stats] Invalid LFRG emission amount: ${amount}`);
  }

  await connectDatabase();
  await GameStatsModel.findOneAndUpdate(
    {},
    [
      {
        $set: {
          totalLfrgEmitted: {
            $add: [{ $ifNull: ["$totalLfrgEmitted", 0] }, amount],
          },
          treasuryBalance: { $ifNull: ["$treasuryBalance", 0] },
          totalDailyQuestsCompleted: {
            $ifNull: ["$totalDailyQuestsCompleted", 0],
          },
          totalWeeklyQuestsCompleted: {
            $ifNull: ["$totalWeeklyQuestsCompleted", 0],
          },
        },
      },
      {
        $set: {
          halvingStage: {
            $min: [4, { $floor: { $divide: ["$totalLfrgEmitted", 20_000_000] } }],
          },
          updatedAt: new Date(),
        },
      },
      {
        $set: {
          emissionMultiplier: {
            $arrayElemAt: [[1, 0.5, 0.25, 0.125, 0.0625], "$halvingStage"],
          },
        },
      },
    ],
    { upsert: true },
  );
}

/**
 * Atomically increments the treasury balance by `amount`.
 * Called by marketplace fee collection and other treasury credit paths.
 */
export async function creditTreasury(amount: number): Promise<void> {
  await connectDatabase();
  await GameStatsModel.findOneAndUpdate(
    {},
    {
      $inc: { treasuryBalance: amount },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}

/**
 * Atomically deducts `amount` from the treasury balance.
 * Clamps to 0 — treasury cannot go negative.
 */
export async function deductTreasury(amount: number): Promise<void> {
  await connectDatabase();
  await GameStatsModel.findOneAndUpdate(
    {},
    [
      {
        $set: {
          treasuryBalance: {
            $max: [0, { $subtract: ["$treasuryBalance", amount] }],
          },
          updatedAt: new Date(),
        },
      },
    ] as unknown as Record<string, unknown>,
    { upsert: true },
  );
}



// ---------------------------------------------------------------------------
// Quest completion counters
// ---------------------------------------------------------------------------

/**
 * Atomically increments the lifetime quest completion counter for the given
 * quest type (`"daily"` or `"weekly"`).
 *
 * Fire-and-forget by design — callers should `.catch()` so a failure here
 * never blocks the completion response.
 */
export async function incrementQuestsCompleted(
  type: "daily" | "weekly",
): Promise<void> {
  await connectDatabase();
  const field = type === "daily"
    ? "totalDailyQuestsCompleted"
    : "totalWeeklyQuestsCompleted";
  await GameStatsModel.findOneAndUpdate(
    {},
    {
      $inc: { [field]: 1 },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}


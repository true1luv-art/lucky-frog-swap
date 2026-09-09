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
        totalHfarmEmitted:          0,
        treasuryBalance:            0,
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
 * Atomically records newly emitted HFARM into the lifetime total.
 */
export async function incrementHfarmEmitted(amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`[game-stats] Invalid HFARM emission amount: ${amount}`);
  }

  await connectDatabase();
  await GameStatsModel.findOneAndUpdate(
    {},
    {
      $inc: { totalHfarmEmitted: amount },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}

/**
 * Raw atomic treasury credit — no validation. Use creditTreasury() externally.
 */
async function creditTreasuryRaw(amount: number): Promise<void> {
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
// Treasury public API — validation + coordination layer
// ---------------------------------------------------------------------------

import { FarmModel } from "@/lib/modules/farms/model.server";

export type TreasurySource      = "marketplace_fee" | "player_deposit";
export type TreasuryDestination = "quest_reward" | "claim_payout" | "player_withdrawal";

export interface TreasuryHealth {
  treasuryBalance:          number;
  totalHfarmEmitted:        number;
  dailyEmissionRate:        number;
  runwayDays:               number;
  questsCompletedToday:     number;
  villageOrdersFilledToday: number;
}

const BASE_DAILY_EMISSION = 2_400;

/**
 * Returns the raw $HFARM treasury balance.
 */
export async function getTreasuryBalance(): Promise<number> {
  const stats = await getGameStats();
  return stats.treasuryBalance;
}

/**
 * Credits $HFARM to the treasury from an identified source.
 * Amount must be a positive integer.
 */
export async function creditTreasury(
  amount: number,
  source: TreasurySource,
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`[treasury] creditTreasury: invalid amount ${amount} (source: ${source})`);
  }
  await creditTreasuryRaw(Math.round(amount));
}

/**
 * Debits $HFARM from the treasury. Clamps to 0. Also records emitted HFARM.
 */
export async function debitTreasury(
  amount:      number,
  destination: TreasuryDestination,
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`[treasury] debitTreasury: invalid amount ${amount} (destination: ${destination})`);
  }
  const rounded = Math.round(amount);
  await deductTreasury(rounded);
  await incrementHfarmEmitted(rounded);
}

/**
 * Returns treasury health metrics for the admin KPI endpoint. §3.5-C
 */
export async function getTreasuryHealth(): Promise<TreasuryHealth> {
  const stats = await getGameStats();

  const dailyEmissionRate = BASE_DAILY_EMISSION;
  const runwayDays =
    dailyEmissionRate > 0
      ? Math.floor(stats.treasuryBalance / dailyEmissionRate)
      : Infinity;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  const [dailyCount, weeklyCount] = await Promise.all([
    FarmModel.aggregate([
      { $unwind: "$quests.daily" },
      { $match: { "quests.daily.status": "completed", "quests.daily.completedAt": { $gte: todayStartMs } } },
      { $count: "n" },
    ]).then((r: Array<{ n: number }>) => r[0]?.n ?? 0),

    FarmModel.aggregate([
      { $unwind: "$quests.weekly" },
      { $match: { "quests.weekly.status": "completed", "quests.weekly.completedAt": { $gte: todayStartMs } } },
      { $count: "n" },
    ]).then((r: Array<{ n: number }>) => r[0]?.n ?? 0),
  ]);

  return {
    treasuryBalance:         stats.treasuryBalance,
    totalHfarmEmitted:       stats.totalHfarmEmitted,
    dailyEmissionRate,
    runwayDays:              runwayDays === Infinity ? -1 : runwayDays,
    questsCompletedToday:    dailyCount + weeklyCount,
    villageOrdersFilledToday: 0,
  };
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


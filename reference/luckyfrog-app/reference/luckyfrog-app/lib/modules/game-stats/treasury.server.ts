/**
 * lib/modules/game-stats/treasury.server.ts
 *
 * Treasury service — all $LFRG treasury accounting. §3.5-A
 *
 * The treasury tracks the pool of $LFRG funded by game inflows and marketplace
 * fees. It is NOT the player reward ledger — individual player LFRG balances
 * live on the player document. The treasury is used to:
 *   - Record inflows (game economy credits and marketplace fees).
 *   - Record outflows (quest rewards and other game payouts).
 *   - Report economic health to the admin KPI endpoint (§3.5-C).
 *
 * All amounts are in whole $LFRG (integer).
 * No SOL conversion is performed — the treasury is denominated in $LFRG only.
 *
 * Reference: docs/implementation_plans/phase-03-quest-system.md §3.5-A
 */

import {
  getGameStats,
  creditTreasury   as dbCreditTreasury,
  deductTreasury   as dbDeductTreasury,
  incrementLfrgEmitted,
} from "@/lib/modules/game-stats/repository.server";
import { FarmModel }      from "@/lib/modules/farms/model.server";
import { getCurrentHalvingStep } from "@/lib/modules/game-stats/halving";

// ---------------------------------------------------------------------------
// Source / destination labels — stored on treasury ledger entries (future use)
// ---------------------------------------------------------------------------

export type TreasurySource =
  | "marketplace_fee"
  | "admin_credit";

export type TreasuryDestination =
  | "quest_reward"
  | "claim_payout"
  | "admin_debit";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns the raw $LFRG treasury balance.
 */
export async function getTreasuryBalance(): Promise<number> {
  const stats = await getGameStats();
  return stats.treasuryBalance;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Credits $LFRG to the treasury from an identified source.
 * Called for confirmed game economy inflows and marketplace fee collection.
 * Amount must be a positive integer.
 *
 * @param amount - Whole $LFRG to add.
 * @param source - Identifies the inflow source for audit purposes.
 */
export async function creditTreasury(
  amount: number,
  source: TreasurySource,
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      `[treasury] creditTreasury: invalid amount ${amount} (source: ${source})`,
    );
  }
  await dbCreditTreasury(Math.round(amount));
}

/**
 * Debits $LFRG from the treasury for a payout.
 * Clamps to 0 — treasury cannot go negative.
 * Also records the amount as emitted via incrementLfrgEmitted.
 *
 * @param amount      - Whole $LFRG to deduct.
 * @param destination - Identifies the outflow destination for audit purposes.
 */
export async function debitTreasury(
  amount: number,
  destination: TreasuryDestination,
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      `[treasury] debitTreasury: invalid amount ${amount} (destination: ${destination})`,
    );
  }
  const rounded = Math.round(amount);
  await dbDeductTreasury(rounded);
  await incrementLfrgEmitted(rounded);
}

// ---------------------------------------------------------------------------
// Health / KPI
// ---------------------------------------------------------------------------

/**
 * Returns treasury health metrics for the admin KPI endpoint. §3.5-C
 *
 * Runway is calculated as:
 *   runwayDays = treasuryBalance / dailyEmissionRate
 *
 * dailyEmissionRate is estimated from the configured halving schedule and
 * a fixed BASE_DAILY_EMISSION constant. The actual rate depends on active
 * player count; this is a conservative baseline estimate.
 *
 * 30-day inflow/outflow are approximated from quests completed × average
 * reward. A future ledger table can replace this with exact bookkeeping.
 */
export interface TreasuryHealth {
  treasuryBalance:       number;
  totalLfrgEmitted:      number;
  halvingStage:          number;
  emissionMultiplier:    number;
  dailyEmissionRate:     number;
  runwayDays:            number;
  questsCompletedToday:  number;
  villageOrdersFilledToday: number;
}

/**
 * Base daily emission (in $LFRG) at halving stage 0, full emission rate.
 * Adjust this when the Passive Mining constants are finalised.
 */
const BASE_DAILY_EMISSION = 2_400;

export async function getTreasuryHealth(): Promise<TreasuryHealth> {
  const stats = await getGameStats();
  const halving = getCurrentHalvingStep(stats.totalLfrgEmitted);

  const dailyEmissionRate =
    Math.round(BASE_DAILY_EMISSION * halving.emissionMultiplier);

  const runwayDays =
    dailyEmissionRate > 0
      ? Math.floor(stats.treasuryBalance / dailyEmissionRate)
      : Infinity;

  // Count quests completed today from embedded farm quests.
  const todayStart     = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartMs   = todayStart.getTime();

  // Aggregate across all farm documents: count embedded daily+weekly quests
  // completed since midnight UTC. Village orders no longer exist (§fold-quests).
  const [dailyCount, weeklyCount] = await Promise.all([
    FarmModel.aggregate([
      { $unwind: "$quests.daily" },
      {
        $match: {
          "quests.daily.status":      "completed",
          "quests.daily.completedAt": { $gte: todayStartMs },
        },
      },
      { $count: "n" },
    ]).then((r: Array<{ n: number }>) => r[0]?.n ?? 0),

    FarmModel.aggregate([
      { $unwind: "$quests.weekly" },
      {
        $match: {
          "quests.weekly.status":      "completed",
          "quests.weekly.completedAt": { $gte: todayStartMs },
        },
      },
      { $count: "n" },
    ]).then((r: Array<{ n: number }>) => r[0]?.n ?? 0),
  ]);

  const questsCompletedToday      = dailyCount + weeklyCount;
  const villageOrdersFilledToday   = 0; // Village orders removed (§fold-quests).

  return {
    treasuryBalance:         stats.treasuryBalance,
    totalLfrgEmitted:        stats.totalLfrgEmitted,
    halvingStage:            halving.stage,
    emissionMultiplier:      halving.emissionMultiplier,
    dailyEmissionRate,
    runwayDays:              runwayDays === Infinity ? -1 : runwayDays,
    questsCompletedToday,
    villageOrdersFilledToday,
  };
}

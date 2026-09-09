/**
 * GET /api/admin/marketplace/treasury
 *
 * Returns total marketplace fees collected, the current treasury balance,
 * and a breakdown by time window. §4.5-D
 *
 * All fee figures are derived from the immutable marketplace_logs records.
 * The live treasury balance comes from the game-stats document (same source
 * as the existing /api/admin/economy-stats endpoint).
 *
 * Auth: x-admin-secret header. §4.5-D
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.5-D
 */

import { headers }                 from "next/headers";
import { connectDatabase }         from "@/lib/config/database";
import { MarketplaceLogModel } from "@/lib/modules/marketplace-logs/model.server";
import { getTreasuryBalance }      from "@/lib/modules/game-stats/treasury.server";

export const runtime = "nodejs";

async function requireAdminAuth(): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const headerStore = await headers();
  const provided    = headerStore.get("x-admin-secret");
  return provided === adminSecret;
}

export async function GET() {
  const authed = await requireAdminAuth();
  if (!authed) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDatabase();

  const now        = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const monthStart = new Date(now);
  monthStart.setUTCDate(monthStart.getUTCDate() - 30);

  const [feeAgg, treasuryBalance, tradeCount] = await Promise.all([
    // Fee aggregation across time windows via $facet
    MarketplaceLogModel.aggregate([
      // Only player-to-player sales — exclude protocol egg buys (refunded, fee 0).
      { $match: { type: "market_sale" } },
      {
        $facet: {
          today: [
            { $match: { completedAt: { $gte: todayStart } } },
            { $group: { _id: null, fees: { $sum: "$fee" }, trades: { $sum: 1 }, volume: { $sum: "$totalPrice" } } },
          ],
          week: [
            { $match: { completedAt: { $gte: weekStart } } },
            { $group: { _id: null, fees: { $sum: "$fee" }, trades: { $sum: 1 }, volume: { $sum: "$totalPrice" } } },
          ],
          month: [
            { $match: { completedAt: { $gte: monthStart } } },
            { $group: { _id: null, fees: { $sum: "$fee" }, trades: { $sum: 1 }, volume: { $sum: "$totalPrice" } } },
          ],
          allTime: [
            { $group: { _id: null, fees: { $sum: "$fee" }, trades: { $sum: 1 }, volume: { $sum: "$totalPrice" } } },
          ],
        },
      },
    ]),

    // Live treasury balance from game-stats
    getTreasuryBalance(),

    // Total trade count
    MarketplaceLogModel.countDocuments({ type: "market_sale" }),
  ]);

  const facet      = (feeAgg as Array<Record<string, Array<Record<string, number>>>>)[0] ?? {};
  const todayRow   = facet.today?.[0]   ?? {};
  const weekRow    = facet.week?.[0]    ?? {};
  const monthRow   = facet.month?.[0]   ?? {};
  const allTimeRow = facet.allTime?.[0] ?? {};

  return Response.json({
    treasuryBalance,
    fees: {
      today:   { fees: todayRow.fees   ?? 0, trades: todayRow.trades   ?? 0, volume: todayRow.volume   ?? 0 },
      week:    { fees: weekRow.fees    ?? 0, trades: weekRow.trades    ?? 0, volume: weekRow.volume    ?? 0 },
      month:   { fees: monthRow.fees   ?? 0, trades: monthRow.trades   ?? 0, volume: monthRow.volume   ?? 0 },
      allTime: { fees: allTimeRow.fees ?? 0, trades: allTimeRow.trades ?? 0, volume: allTimeRow.volume ?? 0 },
    },
    totalTradeCount: tradeCount,
    generatedAt: now.toISOString(),
  });
}

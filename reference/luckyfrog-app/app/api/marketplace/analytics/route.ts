/**
 * GET /api/marketplace/analytics
 *
 * Marketplace analytics aggregated from the `listings` collection.
 * All aggregations target sold listings directly — no `marketplace_logs`
 * join needed. §redesign §5
 *
 * `avgListingDurationHours` is now computable: completedAt - createdAt.
 *
 * No auth required — publicly readable.
 */

import {
  countAllActiveListings,
  getVolumeStats,
  getTopAssets,
  getMostActiveSellers,
} from "@/lib/modules/listings/repository.server";
import { ListingModel } from "@/lib/modules/listings/model.server";
import { connectDatabase } from "@/lib/config/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await connectDatabase();

  const [activeListingCount, volumeStats, topAssets, mostActiveSellers] =
    await Promise.all([
      countAllActiveListings(),
      getVolumeStats(),
      getTopAssets(10),
      getMostActiveSellers(5),
    ]);

  // avgListingDurationHours: average of (completedAt - createdAt) in hours
  // for all sold listings over the last 30 days.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [durationRow] = await ListingModel.aggregate<{ avgMs: number }>([
    { $match: { status: "sold", completedAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        avgMs: {
          $avg: { $subtract: ["$completedAt", "$createdAt"] },
        },
      },
    },
  ]);
  const avgListingDurationHours =
    durationRow?.avgMs != null
      ? Math.round((durationRow.avgMs / 3_600_000) * 100) / 100
      : null;

  const now = new Date();
  return Response.json({
    volumeToday:            parseFloat(volumeStats.volumeToday.toFixed(4)),
    volumeWeek:             parseFloat(volumeStats.volumeWeek.toFixed(4)),
    totalVolumeAllTime:     parseFloat(volumeStats.totalVolumeAllTime.toFixed(4)),
    feesCollectedToday:     parseFloat(volumeStats.feesCollectedToday.toFixed(4)),
    feesCollectedTotal:     parseFloat(volumeStats.feesCollectedTotal.toFixed(4)),
    activeListingCount,
    topAssets,
    mostActiveSellers,
    avgListingDurationHours,
    generatedAt: now.toISOString(),
  });
}

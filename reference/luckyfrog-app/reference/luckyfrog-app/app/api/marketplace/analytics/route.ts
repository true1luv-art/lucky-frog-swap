/**
 * GET /api/marketplace/analytics
 *
 * Marketplace analytics aggregated from the immutable `marketplace_logs`
 * collection. No modification to any other collection. §4.5-C, GDD §9.22
 *
 * All statistics are derived solely from history records — never from live
 * listing state — so this endpoint is safe to cache and always consistent.
 *
 * No auth required — publicly readable statistics.
 *
 * Response shape matches the GDD §9.22 analytics spec exactly:
 *   volumeToday, volumeWeek, totalVolumeAllTime,
 *   feesCollectedToday, feesCollectedTotal,
 *   topAssets (by volume), mostExpensiveFrogSold,
 *   mostActiveSellers, avgListingDurationHours
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.5-C
 */

import { MarketplaceLogModel } from "@/lib/modules/marketplace-logs/model.server";
import { countAllActiveListings } from "@/lib/modules/marketplace/query.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {

  const now        = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  // Run all aggregations in parallel for performance.
  const [
    volumeStats,
    topAssets,
    mostExpensiveFrog,
    mostActiveSellers,
  ] = await Promise.all([

    // ── Volume + fee aggregations ─────────────────────────────────────────────
    MarketplaceLogModel.aggregate([
      // Only player-to-player sales — exclude protocol egg buys (refunded).
      { $match: { type: "market_sale" } },
      {
        $facet: {
          today: [
            { $match: { completedAt: { $gte: todayStart } } },
            {
              $group: {
                _id:              null,
                volumeToday:      { $sum: "$totalPrice" },
                feesToday:        { $sum: "$fee" },
              },
            },
          ],
          week: [
            { $match: { completedAt: { $gte: weekStart } } },
            {
              $group: {
                _id:         null,
                volumeWeek:  { $sum: "$totalPrice" },
              },
            },
          ],
          allTime: [
            {
              $group: {
                _id:                 null,
                totalVolumeAllTime:  { $sum: "$totalPrice" },
                feesCollectedTotal:  { $sum: "$fee" },
              },
            },
          ],
        },
      },
    ]),

    // ── Top assets by total volume (last 30 days) ─────────────────────────────
    MarketplaceLogModel.aggregate([
      {
        $match: {
          type: "market_sale",
          completedAt: {
            $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id:      "$assetName",
          assetType: { $first: "$assetType" },
          volume:   { $sum: "$totalPrice" },
          trades:   { $sum: 1 },
          avgPrice: { $avg: "$price" },
        },
      },
      { $sort: { volume: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id:      0,
          assetName: "$_id",
          assetType: 1,
          volume:   1,
          trades:   1,
          avgPrice: { $round: ["$avgPrice", 4] },
        },
      },
    ]),

    // ── Most expensive frog sold (all time) ───────────────────────────────────
    MarketplaceLogModel
      .findOne({ type: "market_sale", assetType: "frog" })
      .sort({ totalPrice: -1 })
      .select("assetId assetName totalPrice completedAt sellerId buyerId")
      .lean(),

    // ── Most active sellers (last 30 days, by trade count) ───────────────────
    MarketplaceLogModel.aggregate([
      {
        $match: {
          type: "market_sale",
          completedAt: {
            $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id:    "$sellerId",
          trades: { $sum: 1 },
          volume: { $sum: "$totalPrice" },
        },
      },
      { $sort: { trades: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id:      0,
          sellerId: "$_id",
          trades:   1,
          volume:   { $round: ["$volume", 4] },
        },
      },
    ]),
  ]);

  // ── Extract scalar values from $facet result ──────────────────────────────
  const facet        = (volumeStats as Array<{ today: Array<Record<string,number>>, week: Array<Record<string,number>>, allTime: Array<Record<string,number>> }>)[0] ?? {};
  const todayRow     = facet.today?.[0]   ?? {};
  const weekRow      = facet.week?.[0]    ?? {};
  const allTimeRow   = facet.allTime?.[0] ?? {};

  const volumeToday          = todayRow.volumeToday         ?? 0;
  const feesCollectedToday   = todayRow.feesToday           ?? 0;
  const volumeWeek           = weekRow.volumeWeek           ?? 0;
  const totalVolumeAllTime   = allTimeRow.totalVolumeAllTime ?? 0;
  const feesCollectedTotal   = allTimeRow.feesCollectedTotal ?? 0;

  // Listing duration (listed → sold) can no longer be derived from
  // `marketplace_logs` alone: the sale record does not carry the original
  // listed-at timestamp, and the `marketplace_listings` index that once held it
  // has been removed. §Phase 3 / Phase 6. Reported as null (not tracked) rather
  // than a misleading 0.
  const avgListingDurationHours: number | null = null;

  // ── Active listing count ──────────────────────────────────────────────────
  // Aggregated across the four tradable collections' embedded `market` sub-docs
  // now that the standalone marketplace_listings index is gone. §Phase 3
  const activeListingCount = await countAllActiveListings();

  return Response.json({
    volumeToday:            parseFloat(volumeToday.toFixed(4)),
    volumeWeek:             parseFloat(volumeWeek.toFixed(4)),
    totalVolumeAllTime:     parseFloat(totalVolumeAllTime.toFixed(4)),
    feesCollectedToday:     parseFloat(feesCollectedToday.toFixed(4)),
    feesCollectedTotal:     parseFloat(feesCollectedTotal.toFixed(4)),
    activeListingCount,
    topAssets,
    mostExpensiveFrogSold:  mostExpensiveFrog ?? null,
    mostActiveSellers,
    avgListingDurationHours,
    generatedAt:            now.toISOString(),
  });
}

/**
 * GET /api/admin/marketplace/suspicious
 *
 * Returns active listings whose price is statistically anomalous — more than
 * 3 standard deviations above or below the median sold price for that asset
 * over the last 30 days. §4.5-D, GDD §9.23
 *
 * Uses the same x-admin-secret auth pattern as all other admin endpoints.
 *
 * Algorithm:
 *   1. For each distinct assetName with at least 5 history records in the last
 *      30 days, compute mean and standard deviation of `price` from history.
 *   2. Find all active listings for those assetNames.
 *   3. Flag any listing where |price − mean| > 3σ.
 *
 * A listing below 3σ could indicate wash-trading (underpriced to move assets
 * to another account). A listing above 3σ could indicate price manipulation.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.5-D
 */

import { headers }                 from "next/headers";
import { connectDatabase }         from "@/lib/config/database";
import { MarketplaceLogModel } from "@/lib/modules/marketplace-logs/model.server";
import { findActiveListingsByAssetNames } from "@/lib/modules/marketplace/query.server";

export const runtime = "nodejs";

// Minimum history records required before flagging an asset as suspicious.
const MIN_HISTORY_COUNT = 5;
// Number of standard deviations from the mean to flag as suspicious.
const SIGMA_THRESHOLD   = 3;

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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Step 1: Compute per-asset price statistics from history.
  const priceStats = await MarketplaceLogModel.aggregate([
    { $match: { type: "market_sale", completedAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id:    "$assetName",
        count:  { $sum: 1 },
        mean:   { $avg: "$price" },
        prices: { $push: "$price" },
      },
    },
    { $match: { count: { $gte: MIN_HISTORY_COUNT } } },
  ]) as Array<{ _id: string; count: number; mean: number; prices: number[] }>;

  if (priceStats.length === 0) {
    return Response.json({ suspicious: [], analyzedAssets: 0, note: "Insufficient history data" });
  }

  // Compute stddev in JS (MongoDB $stdDevPop available but we already have prices).
  const statsMap = new Map<string, { mean: number; stddev: number }>();
  for (const row of priceStats) {
    const mean   = row.mean;
    const variance = row.prices.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / row.prices.length;
    const stddev = Math.sqrt(variance);
    statsMap.set(row._id, { mean, stddev });
  }

  // Step 2: Load active listings for assets that have enough history.
  // Reconstructed from the embedded `market` sub-docs across the four tradable
  // collections now that the marketplace_listings index is gone. §Phase 3
  const assetNames = [...statsMap.keys()];
  const activeListings = await findActiveListingsByAssetNames(assetNames);

  // Step 3: Flag anomalous listings.
  const suspicious = activeListings
    .map((listing) => {
      const stats = statsMap.get(listing.assetName);
      if (!stats || stats.stddev === 0) return null;

      const zScore    = Math.abs(listing.price - stats.mean) / stats.stddev;
      const direction = listing.price > stats.mean ? "above" : "below";

      if (zScore < SIGMA_THRESHOLD) return null;

      return {
        listingId:     listing.hash,
        assetType:     listing.assetType,
        assetName:     listing.assetName,
        assetId:       listing.assetId,
        sellerId:      listing.sellerId,
        price:         listing.price,
        quantity:      listing.quantity,
        createdAt:     listing.createdAt,
        expiresAt:     listing.expiresAt,
        stats: {
          mean:      parseFloat(stats.mean.toFixed(6)),
          stddev:    parseFloat(stats.stddev.toFixed(6)),
          zScore:    parseFloat(zScore.toFixed(2)),
          direction,
          sigma:     `${parseFloat(zScore.toFixed(1))}σ ${direction} mean`,
        },
      };
    })
    .filter(Boolean);

  // Sort by zScore descending — most anomalous first.
  suspicious.sort((a, b) => (b!.stats.zScore - a!.stats.zScore));

  return Response.json({
    suspicious,
    analyzedAssets: assetNames.length,
    totalFlagged:   suspicious.length,
    parameters: {
      sigmaThreshold:  SIGMA_THRESHOLD,
      minHistoryCount: MIN_HISTORY_COUNT,
      windowDays:      30,
    },
    generatedAt: new Date().toISOString(),
  });
}

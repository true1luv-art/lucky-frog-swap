/**
 * GET /api/marketplace/history/prices
 *
 * Returns average and median sale price per day for a given asset, over a
 * configurable window of days. Used for the price trend chart in the
 * listing detail modal. §4.3-C
 *
 * Query params:
 *   assetName  — required; item name or frog name prefix  e.g. "Iron Ore"
 *   assetType  — optional; narrows to one asset type
 *   days       — number of trailing days to include (default 7, max 90)
 *
 * Response:
 *   { history: Array<{ date: string; avg: number; median: number; volume: number }> }
 *
 * "date" is ISO date string (YYYY-MM-DD) in UTC.
 * Days with no sales are omitted — the UI fills gaps.
 *
 * No auth required — publicly readable.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.3-C
 */

import { MarketplaceLogModel } from "@/lib/modules/marketplace-logs/model.server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const assetName = searchParams.get("assetName");
  const assetType = searchParams.get("assetType") ?? undefined;
  const daysParam = searchParams.get("days");
  const days      = Math.min(90, Math.max(1, parseInt(daysParam ?? "7", 10)));

  if (!assetName) {
    return Response.json(
      { error: "assetName query parameter is required", code: "MISSING_ASSET_NAME" },
      { status: 400 },
    );
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);


  // Match stage — filter by asset name, optional type, and date window
  const matchStage: Record<string, unknown> = {
    type: "market_sale",
    assetName,
    completedAt: { $gte: since },
  };
  if (assetType) matchStage.assetType = assetType;

  /**
   * Aggregate by calendar day (UTC). For each day:
   *   - avg:    average sale price per unit
   *   - prices: array of all per-unit prices (for median computation)
   *   - volume: total units sold
   *
   * MongoDB has no native $median operator before v7. We push all prices into
   * an array and sort them; the median is computed in JS after the aggregation.
   */
  const raw = await MarketplaceLogModel.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          // Truncate to UTC calendar day
          $dateToString: { format: "%Y-%m-%d", date: "$completedAt", timezone: "UTC" },
        },
        avg:    { $avg: "$price" },
        prices: { $push: "$price" },
        volume: { $sum: "$quantity" },
        count:  { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Compute median for each day in JS
  const history = raw.map((bucket) => {
    const sorted: number[] = [...(bucket.prices as number[])].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

    return {
      date:   bucket._id as string,
      avg:    Math.round(bucket.avg * 100) / 100,
      median: Math.round(median * 100) / 100,
      volume: bucket.volume as number,
      count:  bucket.count as number,
    };
  });

  return Response.json({ history, days, assetName });
}

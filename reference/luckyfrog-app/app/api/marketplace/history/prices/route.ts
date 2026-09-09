/**
 * GET /api/marketplace/history/prices
 *
 * Returns average and median sale price per day for a given asset.
 * Queries the `listings` collection (sold listings only) — no `marketplace_logs`
 * join needed. §redesign §5
 *
 * Query params:
 *   assetName  — required
 *   assetType  — optional; narrows to one asset type
 *   days       — trailing days window (default 7, max 90)
 *
 * Response:
 *   { history: Array<{ date, avg, median, volume, count }> }
 */

import { getPriceHistory } from "@/lib/modules/listings/repository.server";

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

  const history = await getPriceHistory({ item: assetName, assetType, days });
  return Response.json({ history, days, assetName });
}

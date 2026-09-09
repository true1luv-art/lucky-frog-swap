/**
 * app/api/marketplace/activity/route.ts
 *
 * GET /api/marketplace/activity?limit=20
 *
 * Returns the 20 most recent marketplace_logs entries where the authenticated
 * player is the seller (sales, expirations, cancellations). The client persists
 * `seenAt` in localStorage; any log whose `completedAt` is newer than `seenAt`
 * is considered "unseen" and drives the badge count.
 *
 * No separate notifications collection — `marketplace_logs` is the source of
 * truth. §fold-notifications
 */

import { getWallet }         from "@/lib/api/get-wallet";
import { apiError, apiOk }   from "@/lib/api/error-response";
import { MarketplaceLogModel } from "@/lib/modules/marketplace-logs/model.server";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

export async function GET(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const url   = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );


  const logs = await MarketplaceLogModel
    .find({ sellerId: wallet })
    .sort({ completedAt: -1 })
    .limit(limit)
    .select("type listingId assetName assetType quantity totalPrice fee sellerNet completedAt")
    .lean();

  return apiOk({ activity: logs });
}

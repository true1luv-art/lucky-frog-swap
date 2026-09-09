/**
 * GET /api/marketplace/listings/mine
 *
 * Returns all marketplace listings (across all statuses) for the authenticated
 * player. Includes an earnings breakdown per sold listing by joining against
 * the marketplace_logs collection (type: "market_sale"). §4.3-D
 *
 * Query params (all optional):
 *   status  — filter to one status: active | sold | cancelled | expired
 *   page    — 1-based page number (default 1)
 *   limit   — items per page (default 20, max 100)
 *
 * Response:
 * ```json
 * {
 *   listings: Array<ListingWithEarnings>,
 *   total: number,
 *   page: number,
 *   pages: number,
 *   summary: {
 *     activeCount: number,
 *     totalEarned: number,   // sum of sellerNet across all sold listings
 *     totalFeesPaid: number  // sum of fee across all sold listings
 *   }
 * }
 * ```
 *
 * Each sold listing has an `earnings` field with `{ sellerNet, fee, totalPrice }`
 * pulled from the immutable history record. §4.3-D
 *
 * Authentication required: Bearer token or lfrg_token cookie.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.3-D
 */

import { getWallet } from "@/lib/api/get-wallet";
import { findActiveListingsBySeller } from "@/lib/modules/marketplace/query.server";
import type { ListingStatus, ListingView } from "@/shared/marketplace/listing-view";
import type { TradableAssetType } from "@/shared/types/marketplace";
import { MarketplaceLogModel } from "@/lib/modules/marketplace-logs/model.server";
import type { MarketplaceLogType } from "@/lib/modules/marketplace-logs/types.server";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const status = searchParams.get("status") as ListingStatus | null;
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const VALID_STATUSES: ListingStatus[] = ["active", "sold", "cancelled", "expired"];
  if (status && !VALID_STATUSES.includes(status)) {
    return Response.json({ error: "Invalid status filter", code: "INVALID_STATUS" }, { status: 400 });
  }


  // Maps a marketplace_logs `type` to the listing status shown in "My Listings".
  const LOG_TYPE_TO_STATUS = {
    market_sale:       "sold",
    listing_cancelled: "cancelled",
    listing_expired:   "expired",
  } satisfies Partial<Record<MarketplaceLogType, ListingStatus>>;

  type MineListing = ListingView & {
    earnings: { sellerNet: number; fee: number; totalPrice: number } | null;
  };

  // ── Active listings come from the live embedded `market` sub-documents ──────
  let active: MineListing[] = [];
  if (!status || status === "active") {
    const activeViews = await findActiveListingsBySeller(wallet);
    active = activeViews.map((v) => ({ ...v, earnings: null }));
  }

  // ── Terminal listings (sold / cancelled / expired) come from the immutable
  //    marketplace_logs history — the standalone listings index is gone. ───────
  const wantedLogTypes = (
    Object.entries(LOG_TYPE_TO_STATUS) as [MarketplaceLogType, ListingStatus][]
  )
    .filter(([, s]) => !status || status === s)
    .map(([t]) => t);

  let terminal: MineListing[] = [];
  if (wantedLogTypes.length > 0) {
    const logs = await MarketplaceLogModel
      .find({ sellerId: wallet, type: { $in: wantedLogTypes } })
      .sort({ completedAt: -1 })
      .lean();

    terminal = logs.map((log) => {
      const s = LOG_TYPE_TO_STATUS[log.type as keyof typeof LOG_TYPE_TO_STATUS];
      return {
        _id:        log.listingId ?? String(log._id),
        hash:       log.listingId ?? "",
        assetType:  log.assetType as TradableAssetType,
        assetId:    log.assetId,
        assetName:  log.assetName,
        sellerId:   log.sellerId ?? wallet,
        sellerName: log.sellerId ?? wallet,
        price:      log.price,
        quantity:   log.quantity,
        category:   log.assetType,
        status:     s,
        createdAt:  log.completedAt,
        expiresAt:  log.completedAt,
        earnings:
          s === "sold"
            ? { sellerNet: log.sellerNet, fee: log.fee, totalPrice: log.totalPrice }
            : null,
      };
    });
  }

  // Merge, sort by recency, paginate in application code.
  const merged = [...active, ...terminal].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const total = merged.length;
  const start = (page - 1) * limit;
  const pageListings = merged.slice(start, start + limit);

  // Summary — active count from embeds (reuse the already-fetched set when the
  // active tab was included; otherwise count once), earnings from history.
  const activeCount =
    !status || status === "active"
      ? active.length
      : (await findActiveListingsBySeller(wallet)).length;

  const earningsSummary = await MarketplaceLogModel.aggregate([
    { $match: { type: "market_sale", sellerId: wallet } },
    {
      $group: {
        _id:           null,
        totalEarned:   { $sum: "$sellerNet" },
        totalFeesPaid: { $sum: "$fee" },
      },
    },
  ]);

  const summary = {
    activeCount,
    totalEarned:   Math.round((earningsSummary[0]?.totalEarned ?? 0) * 100) / 100,
    totalFeesPaid: Math.round((earningsSummary[0]?.totalFeesPaid ?? 0) * 100) / 100,
  };

  return Response.json({
    listings: pageListings,
    total,
    page,
    pages: Math.ceil(total / limit),
    summary,
  });
}

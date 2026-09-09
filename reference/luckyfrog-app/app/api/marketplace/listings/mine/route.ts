/**
 * GET /api/marketplace/listings/mine
 *
 * Returns all marketplace listings for the authenticated player.
 * All data comes from a single query on the `listings` collection —
 * no `marketplace_logs` join needed. §redesign §mine
 *
 * Query params (all optional):
 *   status  — filter to one status: active | sold | cancelled
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
 *     totalEarned: number,
 *     totalFeesPaid: number
 *   }
 * }
 * ```
 */

import { getWallet }    from "@/lib/api/get-wallet";
import { PlayerModel }  from "@/lib/modules/players/model.server";
import { Types }        from "mongoose";
import {
  findListingsBySeller,
  getSellerEarnings,
  countActiveListingsBySeller,
} from "@/lib/modules/listings/repository.server";
import type { ListingStatus } from "@/lib/modules/listings/types.server";
import type { TradableAssetType } from "@/features/types/marketplace";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const statusParam = searchParams.get("status") as ListingStatus | null;
  const page        = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit       = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const VALID_STATUSES: ListingStatus[] = ["active", "sold", "cancelled"];
  if (statusParam && !VALID_STATUSES.includes(statusParam)) {
    return Response.json({ error: "Invalid status filter", code: "INVALID_STATUS" }, { status: 400 });
  }

  // Resolve wallet → player _id (seller is stored as ObjectId ref).
  const player = await PlayerModel
    .findOne({ wallet }, { _id: 1 })
    .lean<{ _id: Types.ObjectId }>();
  if (!player) return Response.json({ listings: [], total: 0, page, pages: 0, summary: { activeCount: 0, totalEarned: 0, totalFeesPaid: 0 } });

  const sellerObjectId = player._id;

  // Single query on listings — no logs join.
  const allDocs = await findListingsBySeller(sellerObjectId, statusParam ?? undefined);

  type MineListing = {
    _id:      string;
    assetType: TradableAssetType;
    assetId:  string;
    assetName: string;
    sellerId: string;
    sellerName: string;
    price:    number;
    quantity: number;
    status:   string;
    createdAt: Date;
    completedAt: Date | null;
    earnings: { sellerNet: number; fee: number; totalPrice: number } | null;
  };

  const listings: MineListing[] = allDocs.map((doc) => ({
    _id:         doc._id.toString(),
    assetType:   doc.assetType as TradableAssetType,
    assetId:     doc.item,
    assetName:   doc.item,
    sellerId:    wallet,
    sellerName:  wallet,
    price:       doc.price,
    quantity:    doc.quantity,
    status:      doc.status,
    createdAt:   doc.createdAt,
    completedAt: doc.completedAt,
    earnings:
      doc.status === "sold"
        ? {
            sellerNet:  doc.sellerNet,
            fee:        doc.fee,
            totalPrice: doc.price * doc.quantity,
          }
        : null,
  }));

  // Paginate in application code (the findListingsBySeller fetch is always small
  // per-seller, so this is acceptable).
  const total        = listings.length;
  const start        = (page - 1) * limit;
  const pageListings = listings.slice(start, start + limit);

  // Summary
  const [activeCount, earnings] = await Promise.all([
    statusParam && statusParam !== "active"
      ? countActiveListingsBySeller(sellerObjectId)
      : Promise.resolve(allDocs.filter((d) => d.status === "active").length),
    getSellerEarnings(sellerObjectId),
  ]);

  return Response.json({
    listings: pageListings,
    total,
    page,
    pages: Math.ceil(total / limit),
    summary: {
      activeCount,
      totalEarned:   earnings.totalEarned,
      totalFeesPaid: earnings.totalFeesPaid,
    },
  });
}

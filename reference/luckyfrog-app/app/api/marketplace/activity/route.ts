/**
 * GET /api/marketplace/activity?limit=20
 *
 * Returns the most recent terminal listings (sold or cancelled) where the
 * authenticated player is the seller. The `listings` collection is the
 * source of truth — no `marketplace_logs` join needed. §redesign §5
 *
 * The client persists `seenAt` in localStorage; entries whose `completedAt`
 * is newer than `seenAt` are considered "unseen" and drive the badge count.
 */

import { getWallet }       from "@/lib/api/get-wallet";
import { apiError, apiOk } from "@/lib/api/error-response";
import { ListingModel }    from "@/lib/modules/listings/model.server";
import { PlayerModel }     from "@/lib/modules/players/model.server";
import { connectDatabase } from "@/lib/config/database";
import { Types }           from "mongoose";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

export async function GET(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  await connectDatabase();

  const url   = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  // Resolve wallet → player _id (seller stored as ObjectId ref).
  const player = await PlayerModel
    .findOne({ wallet }, { _id: 1 })
    .lean<{ _id: Types.ObjectId }>();
  if (!player) return apiOk({ activity: [] });

  const docs = await ListingModel
    .find({ seller: player._id, status: { $in: ["sold", "cancelled"] } })
    .sort({ completedAt: -1 })
    .limit(limit)
    .select("_id status item assetType quantity price fee sellerNet buyerId completedAt createdAt")
    .lean();

  // Shape the response to be drop-in compatible with the old marketplace_logs
  // activity shape so the client doesn't need changes.
  const activity = docs.map((doc) => ({
    _id:         doc._id,
    type:        doc.status === "sold" ? "market_sale" : "listing_cancelled",
    listingId:   doc._id.toString(),
    assetName:   doc.item,
    assetType:   doc.assetType,
    quantity:    doc.quantity,
    totalPrice:  doc.price * doc.quantity,
    fee:         doc.fee,
    sellerNet:   doc.sellerNet,
    completedAt: doc.completedAt,
  }));

  return apiOk({ activity });
}

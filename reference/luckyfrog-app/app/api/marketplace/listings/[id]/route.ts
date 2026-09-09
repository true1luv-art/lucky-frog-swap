/**
 * GET    /api/marketplace/listings/[id] — listing detail.
 * DELETE /api/marketplace/listings/[id] — cancel a listing.
 *
 * `[id]` is now the MongoDB `_id` string of the listing document.
 * (In the old API it was a 12-char hash; the URL shape is unchanged.)
 */

import { getWallet } from "@/lib/api/get-wallet";
import { cancelListing } from "@/features/events/cancel-listing/action";
import { getActiveListingById } from "@/lib/modules/listings/repository.server";

// ---------------------------------------------------------------------------
// GET /api/marketplace/listings/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return Response.json({ error: "Listing ID is required", code: "MISSING_ID" }, { status: 400 });
  }

  const listing = await getActiveListingById(id);
  if (!listing) {
    return Response.json({ error: "Listing not found", code: "LISTING_NOT_FOUND" }, { status: 404 });
  }

  // Stackable listings have no single asset document to enrich.
  const liveAsset: Record<string, unknown> | null = null;
  return Response.json({ listing, liveAsset });
}

// ---------------------------------------------------------------------------
// DELETE /api/marketplace/listings/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ error: "Listing ID is required", code: "MISSING_ID" }, { status: 400 });
  }

  // cancelListing expects `hash` for backward compatibility — pass `id`.
  const result = await cancelListing({ playerId: wallet, hash: id });

  if (result.status === "ok") return Response.json(result, { status: 200 });
  if (result.status === "listing-not-found") {
    return Response.json({ error: "Listing not found", code: result.status }, { status: 404 });
  }
  if (result.status === "not-seller") {
    return Response.json({ error: "Only the seller can cancel this listing", code: result.status }, { status: 403 });
  }
  if (result.status === "listing-not-active") {
    return Response.json({ error: "Listing is no longer active", code: result.status }, { status: 409 });
  }
  // asset-reservation-missing
  return Response.json(
    { error: "Listing reservation was already consumed", code: result.status },
    { status: 409 },
  );
}

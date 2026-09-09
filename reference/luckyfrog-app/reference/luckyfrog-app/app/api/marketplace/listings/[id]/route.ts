/**
 * DELETE /api/marketplace/listings/[id]
 *
 * Cancels an active marketplace listing. Only the original seller may cancel.
 *
 * For unique assets (frog, equipment): clears the market embed on the asset
 * document so the asset is immediately unlocked and usable again.
 *
 * For stackable assets: returns the reserved quantity back to the seller's
 * usable inventory and clears the marketReservations entry. §9.7 cancel flow.
 *
 * Authentication: Bearer token or lfrg_token cookie.
 *
 * Path param:
 *   id — MongoDB _id of the marketplace_listings document to cancel.
 *
 * Responses:
 *   200 — cancelled successfully; body contains listing details.
 *   401 — not authenticated.
 *   403 — caller is not the seller.
 *   404 — listing not found.
 *   409 — listing is not active (already sold, cancelled, or expired).
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.2-D
 */

import { getWallet } from "@/lib/api/get-wallet";
import { cancelListing } from "@/lib/events/cancel-listing/action";
import { getActiveListingByHash } from "@/lib/modules/marketplace/query.server";
import { EquipmentModel } from "@/lib/modules/equipments/model.server";

// ---------------------------------------------------------------------------
// GET /api/marketplace/listings/[id] — listing detail + live asset §4.3-B
// ---------------------------------------------------------------------------

/**
 * Returns the active listing view plus the live asset document for full
 * stats display. The listing is resolved from the embedded `market.hash`
 * (the `[id]` path param is the listing hash now that the standalone
 * `marketplace_listings` index has been removed). §4.3-B / §Phase 3
 *
 * The `liveAsset` field is null for stackable assets (no single document
 * to enrich — quantity and price are already in the listing).
 *
 * No auth required — publicly readable.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: hash } = await params;

  if (!hash) {
    return Response.json({ error: "Listing ID is required", code: "MISSING_ID" }, { status: 400 });
  }


  const listing = await getActiveListingByHash(hash);

  if (!listing) {
    return Response.json({ error: "Listing not found", code: "LISTING_NOT_FOUND" }, { status: 404 });
  }

  // Fetch live asset document for unique assets to ensure stats are fresh. §4.3-B
  // Only equipment is tradable now (Phase 3)
  let liveAsset: Record<string, unknown> | null = null;
  if (listing.assetType === "equipment") {
    liveAsset = await EquipmentModel.findById(listing.assetId).lean() as Record<string, unknown> | null;
  }

  return Response.json({ listing, liveAsset });
}

// ---------------------------------------------------------------------------
// Route handler (DELETE)
// ---------------------------------------------------------------------------

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id: hash } = await params;

  if (!hash || typeof hash !== "string") {
    return Response.json({ error: "Listing ID is required", code: "MISSING_ID" }, { status: 400 });
  }

  const result = await cancelListing({ playerId: wallet, hash });

  if (result.status === "ok") {
    return Response.json(result, { status: 200 });
  }
  if (result.status === "listing-not-found") {
    return Response.json({ error: "Listing not found", code: result.status }, { status: 404 });
  }
  if (result.status === "not-seller") {
    return Response.json({ error: "Only the seller can cancel this listing", code: result.status }, { status: 403 });
  }
  if (result.status === "listing-not-active") {
    return Response.json(
      { error: "Listing is no longer active", code: result.status },
      { status: 409 },
    );
  }
  // asset-reservation-missing — listing already consumed by a concurrent purchase
  return Response.json(
    { error: "Listing reservation was already consumed — listing has been marked cancelled", code: result.status },
    { status: 409 },
  );
}

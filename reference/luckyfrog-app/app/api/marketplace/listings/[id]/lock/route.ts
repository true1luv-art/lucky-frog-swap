/**
 * POST /api/marketplace/listings/[id]/lock
 *   Acquires a 10-minute optimistic purchase lock for the authenticated buyer.
 *   Returns 200 on success, 409 if another player holds the lock.
 *
 * DELETE /api/marketplace/listings/[id]/lock
 *   Releases the lock held by the authenticated buyer (Cancel / X / navigate away).
 */

import { apiError, apiOk } from "@/lib/api/error-response";
import { getWallet }        from "@/lib/api/get-wallet";
import {
  acquireListingLock,
  releaseListingLock,
} from "@/lib/modules/listings/repository.server";

// ---------------------------------------------------------------------------
// POST — acquire lock
// ---------------------------------------------------------------------------

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const buyerWallet = await getWallet(req);
  if (!buyerWallet) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { id: listingId } = await params;
  if (!listingId) return apiError("Listing ID is required", "MISSING_ID", 400);

  const result = await acquireListingLock(listingId, buyerWallet);

  switch (result.status) {
    case "ok":
      return apiOk({ lockedUntil: result.lockedUntil.toISOString() });

    case "listing-not-found":
      return apiError("Listing not found", "LISTING_NOT_FOUND", 404);

    case "listing-not-active":
      return apiError("This listing is no longer active", "LISTING_NOT_ACTIVE", 409);

    case "cannot-lock-own-listing":
      return apiError("You cannot buy your own listing", "CANNOT_BUY_OWN_LISTING", 403);

    case "locked-by-other":
      return apiError(
        `This listing is reserved by another player until ${new Date(result.lockedUntil).toLocaleTimeString()}.`,
        "LISTING_LOCKED",
        409,
        { lockedUntil: result.lockedUntil.toISOString() },
      );
  }
}

// ---------------------------------------------------------------------------
// DELETE — release lock
// ---------------------------------------------------------------------------

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const buyerWallet = await getWallet(req);
  if (!buyerWallet) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { id: listingId } = await params;
  if (!listingId) return apiError("Listing ID is required", "MISSING_ID", 400);

  await releaseListingLock(listingId, buyerWallet);
  return apiOk({ released: true });
}

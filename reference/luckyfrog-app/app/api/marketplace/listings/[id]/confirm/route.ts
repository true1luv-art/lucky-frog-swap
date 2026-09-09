/**
 * GET  /api/marketplace/listings/[id]/confirm  — status poll (unchanged)
 * POST /api/marketplace/listings/[id]/confirm  — Step 3: verify payment + settle
 *
 * After the buyer signs and broadcasts the $LFRG Solana transaction (via
 * /broadcast), they call POST here with the confirmed txHash. The server
 * verifies the on-chain payment landed in the treasury and settles the trade —
 * transferring the item to the buyer's inventory and updating the listing.
 *
 * Body (JSON):
 *   { "txHash": string, "quantity"?: number }
 *
 * Auth: Authorization: Bearer <token> OR lfrg_token cookie.
 */

import { apiError, apiOk } from "@/lib/api/error-response";
import { getWallet } from "@/lib/api/get-wallet";
import {
  getListingById,
  buildPurchaseTransaction,
  settlePurchase,
  clearListingLock,
} from "@/lib/modules/listings/repository.server";
import { findProcessedTransaction } from "@/lib/modules/transactions-processed/repository.server";
import { enqueueMarketplacePurchase } from "@/lib/modules/transactions-pending/repository.server";
import { connectDatabase } from "@/lib/config/database";
import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// GET — read-only listing status poll
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: listingId } = await params;
  if (!listingId) {
    return apiError("Listing ID is required", "MISSING_ID", 400);
  }

  const listing = await getListingById(listingId);

  if (!listing) {
    return Response.json({ listingId, status: "not_found" }, { status: 200 });
  }

  return Response.json({ listingId, status: listing.status }, { status: 200 });
}

// ---------------------------------------------------------------------------
// POST — verify on-chain payment + settle the trade
// ---------------------------------------------------------------------------

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const buyerId = await getWallet(req);
  if (!buyerId) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  // ── Route param ───────────────────────────────────────────────────────────
  const { id: listingId } = await params;
  if (!listingId) return apiError("Listing ID is required", "MISSING_ID", 400);

  // ── Body parsing ──────────────────────────────────────────────────────────
  let txHash: string | undefined;
  let quantity: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.txHash === "string") txHash = body.txHash.trim();
    if (body && typeof body.quantity === "number") quantity = body.quantity;
  } catch { /* fall through */ }

  if (!txHash) {
    return apiError("txHash is required", "MISSING_TX_HASH", 400);
  }

  // ── Idempotency: reject an already-processed payment ─────────────────────
  const already = await findProcessedTransaction(txHash);
  if (already) {
    return apiError("This transaction has already been processed", "ALREADY_PROCESSED", 409);
  }

  // ── Revalidate the listing (prices must not shift between sign and confirm) ─
  const check = await buildPurchaseTransaction(buyerId, listingId, quantity);

  switch (check.status) {
    case "listing-not-found":
      return apiError("Listing not found", "LISTING_NOT_FOUND", 404);
    case "listing-not-active":
      return apiError("This listing is no longer active", "LISTING_NOT_ACTIVE", 409);
    case "cannot-buy-own-listing":
      return apiError("You cannot purchase your own listing", "CANNOT_BUY_OWN_LISTING", 403);
    case "quantity-exceeds-available":
      return apiError(
        `Requested quantity ${check.requested} exceeds available ${check.available}`,
        "QUANTITY_EXCEEDS_AVAILABLE",
        422,
      );
    case "invalid-quantity":
      return apiError("Quantity must be a positive integer", "INVALID_QUANTITY", 400);
    case "insufficient-balance":
    case "build-error":
      return apiError("Purchase validation failed", "BUILD_ERROR", 500);
  }

  const { purchaseQty, totalPrice, fee, sellerNet } = check;

  // ── Verify the on-chain SPL transfer reached the treasury ─────────────────
  try {
    const { verifyMarketplacePayment } = await import(
      "@/server/farm-smart-contract/lib/transfers"
    );
    const verification = await verifyMarketplacePayment(txHash, buyerId, totalPrice);
    if (!verification.valid) {
      return apiError(
        `Payment verification failed: ${verification.reason ?? "no matching transfer"}`,
        "PAYMENT_VERIFICATION_FAILED",
        422,
      );
    }
  } catch (err) {
    console.error("[confirm/route] Payment verification error:", err);
    return apiError(
      `Payment verification error: ${err instanceof Error ? err.message : String(err)}`,
      "PAYMENT_VERIFICATION_ERROR",
      502,
    );
  }

  // ── Enqueue settlement — worker delivers the item + pays the seller ────────
  await connectDatabase();
  let job;
  try {
    job = await enqueueMarketplacePurchase({
      listingId:   new mongoose.Types.ObjectId(listingId),
      buyerWallet: buyerId,
      quantity:    purchaseQty,
      buyerTxHash: txHash,
      totalPrice,
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      return apiError("This payment is already being processed", "ALREADY_QUEUED", 409);
    }
    throw err;
  }

  // Release the optimistic lock now that the purchase is queued.
  // Fire-and-forget — lock expiry handles the worst case.
  clearListingLock(listingId).catch(() => {/* non-fatal */});

  return apiOk(
    {
      success:     true,
      jobId:       job._id.toString(),
      listingId,
      purchaseQty,
      totalPrice,
      fee,
      sellerNet,
      txHash,
      message:     "Payment verified. Purchase queued — poll GET /api/marketplace/listings/{id}/confirm to confirm.",
    },
    202,
  );
}

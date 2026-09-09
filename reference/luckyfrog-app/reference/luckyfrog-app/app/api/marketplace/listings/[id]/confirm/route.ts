/**
 * POST /api/marketplace/listings/[id]/confirm
 *
 * Step 3 of the on-chain purchase flow: after the buyer signs and broadcasts
 * the $LFRG purchase transaction (via /api/eggs/broadcast), they call this
 * endpoint with the confirmed txHash. The server verifies the on-chain payment
 * (direct seller payout + market fee + `buy_item_{hash}` memo) and settles the
 * trade — transferring the asset, updating the listing, and recording history.
 *
 * Body (JSON):
 *   { "txHash": string, "quantity"?: number }
 *   `quantity` is ignored for unique assets (frog, equipment).
 *
 * Auth: Authorization: Bearer <token> OR lfrg_token cookie.
 *
 * All business logic is delegated to the Marketplace Transaction Service.
 */

import { apiError } from "@/lib/api/error-response";
import { getWallet } from "@/lib/api/get-wallet";
import { settleOnChainPurchase } from "@/lib/modules/marketplace/transaction.server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const buyerId = await getWallet(req);
  if (!buyerId) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  // ── Route param ────────────────────────────────────────────────────────────
  const { id: listingId } = await params;
  if (!listingId) {
    return apiError("Listing ID is required", "MISSING_ID", 400);
  }

  // ── Body parsing ───────────────────────────────────────────────────────────
  let txHash: string | undefined;
  let quantity: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.txHash === "string") txHash = body.txHash.trim();
    if (body && typeof body.quantity === "number") quantity = body.quantity;
  } catch {
    // fall through — txHash validated below
  }

  if (!txHash) {
    return apiError("txHash is required", "MISSING_TX_HASH", 400);
  }

  // ── Settle purchase ──────────────────────────────────────────────────────────
  const result = await settleOnChainPurchase(buyerId, listingId, txHash, quantity);

  // ── HTTP status mapping ────────────────────────────────────────────────────
  switch (result.status) {
    case "ok":
      return Response.json(
        {
          success: true,
          totalPrice: result.totalPrice,
          fee: result.fee,
          sellerNet: result.sellerNet,
          purchaseQty: result.purchaseQty,
          listingId: result.listingId,
        },
        { status: 200 },
      );

    case "listing-not-found":
      return apiError("Listing not found", "LISTING_NOT_FOUND", 404);

    case "listing-not-active":
      return apiError("This listing is no longer active", "LISTING_NOT_ACTIVE", 409);

    case "listing-expired":
      return apiError("This listing has expired", "LISTING_EXPIRED", 409);

    case "cannot-buy-own-listing":
      return apiError(
        "You cannot purchase your own listing",
        "CANNOT_BUY_OWN_LISTING",
        403,
      );

    case "listing-locked":
      return apiError(
        "This listing is currently being purchased by another player — try again shortly",
        "LISTING_LOCKED",
        409,
      );

    case "asset-mismatch":
      return apiError(
        `Asset verification failed: ${result.detail}`,
        "ASSET_MISMATCH",
        409,
      );

    case "quantity-exceeds-available":
      return apiError(
        `Requested quantity ${result.requested} exceeds available ${result.available}`,
        "QUANTITY_EXCEEDS_AVAILABLE",
        422,
      );

    case "invalid-quantity":
      return apiError("Quantity must be a positive integer", "INVALID_QUANTITY", 400);

    case "already-processed":
      return apiError("This transaction has already been processed", "ALREADY_PROCESSED", 409);

    case "payment-verification-failed":
      return apiError(
        "On-chain payment verification failed — the transaction did not match this listing",
        "PAYMENT_VERIFICATION_FAILED",
        400,
      );

    case "settlement-error":
      return apiError(`Settlement failed: ${result.detail}`, "SETTLEMENT_ERROR", 500);

    default:
      return apiError("Unknown error", "UNKNOWN", 500);
  }
}

/**
 * POST /api/marketplace/listings/[id]/purchase
 *
 * Step 1 of the marketplace purchase flow.
 *
 * Validates the listing and returns a price quote. The client then sends the
 * ERC-20 $LFRG transfer to the treasury via MetaMask and posts the resulting
 * txHash to /api/marketplace/listings/[id]/confirm to settle the trade.
 *
 * Body (JSON):
 *   { "quantity"?: number }  — defaults to 1.
 *
 * Auth: Bearer <token> OR lfrg_token cookie.
 */

import { apiError } from "@/lib/api/error-response";
import { getWallet } from "@/lib/api/get-wallet";
import { buildPurchaseTransaction } from "@/lib/modules/listings/repository.server";

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
  let quantity: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.quantity === "number") quantity = body.quantity;
  } catch { /* optional */ }

  // ── Validate listing + compute cost breakdown ─────────────────────────────
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
      return apiError(
        `Insufficient balance: you have ${check.available} but need ${check.required}`,
        "INSUFFICIENT_BALANCE",
        422,
      );
    case "build-error":
      return apiError(`Validation failed: ${check.detail}`, "BUILD_ERROR", 500);
  }

  // check.status === "ok" — return the price quote for the client to execute.
  const { purchaseQty, totalPrice, fee, sellerNet } = check;

  return Response.json({
    success:    true,
    totalPrice,
    fee,
    sellerNet,
    purchaseQty,
    listingId,
  });
}

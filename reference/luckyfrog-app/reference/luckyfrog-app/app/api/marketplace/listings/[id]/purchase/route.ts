/**
 * POST /api/marketplace/listings/[id]/purchase
 *
 * Step 1 of the on-chain purchase flow: builds (but does NOT sign) the $LFRG
 * transaction the buyer must sign to purchase a listing. §4.4-D
 *
 * The returned transaction pays the seller their net proceeds directly, pays
 * the marketplace fee to the market wallet, and carries a `buy_item_{hash}`
 * memo binding the payment to this specific listing. The client signs it via
 * Phantom, broadcasts through /api/eggs/broadcast, then finalises the trade
 * via POST /api/marketplace/listings/[id]/confirm.
 *
 * Body (JSON):
 *   { "quantity": number }  — ignored for unique assets (frog, equipment)
 *
 * Auth: Authorization: Bearer <token> OR lfrg_token cookie.
 *
 * All business logic is delegated to the Marketplace Transaction Service
 * (`lib/modules/marketplace/transaction.server.ts`). This route handles only auth
 * extraction, input parsing, and HTTP status mapping.
 */

import { apiError } from "@/lib/api/error-response";
import { getWallet } from "@/lib/api/get-wallet";
import { buildPurchaseTransaction } from "@/lib/modules/marketplace/transaction.server";

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
  let quantity: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.quantity === "number") {
      quantity = body.quantity;
    }
  } catch {
    // Body is optional — proceed with quantity = undefined (means "buy all")
  }

  // ── Build unsigned transaction ───────────────────────────────────────────────
  const result = await buildPurchaseTransaction(buyerId, listingId, quantity);

  // ── HTTP status mapping ────────────────────────────────────────────────────
  switch (result.status) {
    case "ok":
      return Response.json(
        {
          success: true,
          transaction: result.transaction,
          feePayer: result.feePayer,
          memo: result.memo,
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

    case "quantity-exceeds-available":
      return apiError(
        `Requested quantity ${result.requested} exceeds available ${result.available}`,
        "QUANTITY_EXCEEDS_AVAILABLE",
        422,
      );

    case "invalid-quantity":
      return apiError("Quantity must be a positive integer", "INVALID_QUANTITY", 400);

    case "build-error":
      return apiError(
        `Failed to build purchase transaction: ${result.detail}`,
        "BUILD_ERROR",
        500,
      );

    default:
      return apiError("Unknown error", "UNKNOWN", 500);
  }
}

/**
 * features/events/cancel-listing/action.ts
 *
 * Server action: cancel an active marketplace listing. §redesign §10
 *
 * Flow (plan §10):
 *   1. Find listing by _id in listings collection.
 *   2. Guard: status == "active".
 *   3. Guard: caller == seller (unless force == true).
 *   4. listings.updateOne: status = "cancelled", completedAt = now().
 *   5. InventoryModel.updateOne: $inc amount: +listing.quantity, set market: null.
 *      (No log write — the listing document IS the permanent record.)
 *
 * Reference: docs/marketplace-redesign.md §10
 */

import { findListingById, markListingCancelled } from "@/lib/modules/listings/repository.server";
import { clearMarketBackRef } from "@/lib/modules/items/repository.server";
import { PlayerModel }        from "@/lib/modules/players/model.server";

// ---------------------------------------------------------------------------
// Input / Result types
// ---------------------------------------------------------------------------

export interface CancelListingInput {
  /** Wallet address of the player requesting the cancellation. */
  playerId: string;
  /**
   * The listing _id string (previously called "hash" in the old API).
   * The field is named `hash` for backward-compatibility with callers.
   */
  hash: string;
  /**
   * Internal flag — bypasses the seller ownership check.
   * Not used in the redesign (no expiry sweeper), but kept for API compat.
   */
  force?: boolean;
  /**
   * Ignored in the redesign — the listings document is the permanent record.
   * Kept for backward-compatibility with callers that still pass it.
   */
  logType?: string;
}

export type CancelListingResult =
  | {
      status: "ok";
      listingId: string;
      assetType: string;
      assetName: string;
      sellerId: string;
      quantityReturned?: number;
    }
  | { status: "listing-not-found" }
  | { status: "listing-not-active" }
  | { status: "not-seller" }
  | { status: "asset-reservation-missing" };

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

/**
 * Cancels an active marketplace listing.
 *
 * @throws Never — all error states returned as typed result variants.
 */
export async function cancelListing(
  input: CancelListingInput,
): Promise<CancelListingResult> {

  const { playerId, hash, force = false } = input;

  // ── Step 1: Find listing ─────────────────────────────────────────────────
  const listing = await findListingById(hash);
  if (!listing) return { status: "listing-not-found" };

  // ── Step 2: Guard — must be active ──────────────────────────────────────
  if (listing.status !== "active") return { status: "listing-not-active" };

  // ── Step 3: Resolve seller wallet (seller is an ObjectId ref) ───────────
  const sellerDoc = await PlayerModel
    .findById(listing.seller, { wallet: 1 })
    .lean<{ wallet: string }>();
  const sellerWallet = sellerDoc?.wallet ?? "";

  // ── Step 4: Guard — only the seller may cancel ───────────────────────────
  if (!force && sellerWallet !== playerId) return { status: "not-seller" };

  // ── Step 5: Mark listing cancelled ──────────────────────────────────────
  await markListingCancelled(listing._id);

  // ── Step 6: Restore reserved quantity to seller's inventory ─────────────
  await clearMarketBackRef(sellerWallet, listing.item, listing.quantity);

  return {
    status:           "ok",
    listingId:        listing._id.toString(),
    assetType:        listing.assetType,
    assetName:        listing.item,
    sellerId:         sellerWallet,
    quantityReturned: listing.quantity,
  };
}

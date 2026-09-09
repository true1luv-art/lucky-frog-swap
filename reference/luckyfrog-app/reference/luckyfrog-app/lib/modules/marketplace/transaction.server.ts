/**
 * lib/modules/marketplace/transaction.server.ts
 *
 * Marketplace Transaction Service — the single authoritative settlement engine
 * for the LuckyFrog-Smart-Contract ESCROW marketplace. The buyer deposits the
 * FULL price into the MARKET_TEST (escrow) wallet; this service verifies that
 * deposit, transfers the asset, then enqueues the seller's 95 % payout out of
 * escrow (the 5 % fee stays behind). If the asset transfer fails after the
 * deposit, it enqueues a full buyer refund. There is NO off-chain Game Balance
 * debit/credit. §4.4-A
 *
 * Two entry points:
 *   buildPurchaseTransaction() — validates the listing and returns an unsigned
 *     $LFRG transaction (full-price escrow deposit + `tm_purchase-<hash>` memo)
 *     for the buyer to sign via Phantom and broadcast.
 *   settleOnChainPurchase()    — after the buyer broadcasts, verifies the escrow
 *     deposit, transfers the asset, updates the listing index, writes history,
 *     notifies the seller, and enqueues the seller payout (or buyer refund).
 *
 * Settlement order (on-chain adaptation of GDD §9.27):
 *   1. Validate listing index entry (status, expiry, self-purchase guard)
 *   2. Acquire listing lock (prevents concurrent purchases — GDD §9.20)
 *   3. Verify source-of-truth asset still matches the listing
 *   4. Calculate amounts (totalPrice, fee, sellerNet)
 *   5. Idempotency guard (transactions_processed) — inside the lock
 *   6. Verify on-chain payment (buyer→seller net, buyer→market fee, memo)
 *   7. Insert processed-transaction record BEFORE transferring the asset
 *   8. Credit Treasury (fee accounting only — the fee already moved on-chain)
 *   9. Transfer asset ownership (unique) or reduce reservation (stackable)
 *  10. Update listing index (status, quantity, soldAt)
 *  11. Write immutable history record (incl. txHash)
 *  12. Release lock (finally block)
 *
 * The on-chain payment is irreversible. If the asset transfer fails AFTER the
 * processed-transaction record is inserted, we log a CRITICAL manual-recovery
 * message (mirroring the egg grant-failure pattern) — we never refund on-chain.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.4-A–E
 *            docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.20, §9.21, §9.27
 */

import {
  MARKETPLACE_CONFIG,
  computeMarketplaceFee,
  isUniqueAsset,
} from "@/shared/data/marketplace";
import type { TradableAssetType } from "@/shared/types/marketplace";
import type { ListingView } from "@/shared/marketplace/listing-view";
import {
  getActiveListingByHash,
  acquireListingLock,
  releaseListingLock,
} from "@/lib/modules/marketplace/query.server";
import { MarketplaceLogModel } from "@/lib/modules/marketplace-logs/model.server";
import { EquipmentModel } from "@/lib/modules/equipments/model.server";
import { CollectibleModel } from "@/lib/modules/collectibles/model.server";
import { settleCollectibleMarketplaceSale } from "@/lib/modules/collectibles/service.server";
import { connectDatabase } from "@/lib/config/database";
import { InventoryModel } from "@/lib/modules/inventories/model.server";
import { addItems } from "@/lib/modules/inventories/repository.server";
import { creditTreasury }      from "@/lib/modules/game-stats/treasury.server";
import {
  createMarketplacePurchaseTransaction,
  verifyMarketplacePayment,
} from "@/lib/solana/marketplace-payments";
import {
  isTransactionProcessed,
  insertProcessedTransaction,
} from "@/lib/modules/transactions-processed/repository.server";
import { enqueuePayoutJob } from "@/lib/modules/transactions-pending/repository.server";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Amounts + settlement identity shared across the two flows. */
interface PurchaseAmounts {
  purchaseQty: number;
  totalPrice: number;
  fee: number;
  sellerNet: number;
}

export type BuildPurchaseResult =
  | ({
      status: "ok";
      /** Base64 unsigned transaction for the buyer to sign. */
      transaction: string;
      /** Wallet that must sign (the buyer). */
      feePayer: string;
      /** Memo embedded in the transaction (`buy_item_{hash}`). */
      memo: string;
      listingId: string;
    } & PurchaseAmounts)
  | { status: "listing-not-found" }
  | { status: "listing-not-active" }
  | { status: "listing-expired" }
  | { status: "cannot-buy-own-listing" }
  | { status: "quantity-exceeds-available"; requested: number; available: number }
  | { status: "invalid-quantity" }
  | { status: "build-error"; detail: string };

export type SettleResult =
  | ({
      status: "ok";
      listingId: string;
    } & PurchaseAmounts)
  | { status: "listing-not-found" }
  | { status: "listing-not-active" }
  | { status: "listing-expired" }
  | { status: "cannot-buy-own-listing" }
  | { status: "listing-locked" }
  | { status: "asset-mismatch"; detail: string }
  | { status: "quantity-exceeds-available"; requested: number; available: number }
  | { status: "invalid-quantity" }
  | { status: "already-processed" }
  | { status: "payment-verification-failed" }
  | { status: "settlement-error"; detail: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the effective purchase quantity for a listing, applying the
 * unique-asset (always 1) and stackable (defaults to full quantity) rules.
 * Returns either a resolved quantity or a typed error variant.
 */
function resolvePurchaseQty(
  listing: ListingView,
  quantity: number | undefined,
):
  | { ok: true; purchaseQty: number }
  | { ok: false; error: Extract<SettleResult, { status: "invalid-quantity" | "quantity-exceeds-available" }> } {
  if (isUniqueAsset(listing.assetType)) {
    return { ok: true, purchaseQty: 1 };
  }

  const purchaseQty = quantity ?? listing.quantity;
  if (!Number.isInteger(purchaseQty) || purchaseQty <= 0) {
    return { ok: false, error: { status: "invalid-quantity" } };
  }
  if (purchaseQty > listing.quantity) {
    return {
      ok: false,
      error: {
        status: "quantity-exceeds-available",
        requested: purchaseQty,
        available: listing.quantity,
      },
    };
  }
  return { ok: true, purchaseQty };
}

/** Computes totalPrice / fee / sellerNet for a given listing + quantity. */
function computeAmounts(price: number, purchaseQty: number): PurchaseAmounts {
  const totalPrice = price * purchaseQty;
  const fee = computeMarketplaceFee(totalPrice);
  const sellerNet = totalPrice - fee;
  return { purchaseQty, totalPrice, fee, sellerNet };
}

// ---------------------------------------------------------------------------
// 4.4-B — Transfer unique asset (frog or equipment)
// ---------------------------------------------------------------------------

const EMPTY_MARKET = {
  listed:   false,
  price:    0,
  seller:   null,
  created:  null,
  expires:  null,
  sold:     false,
  hash:     undefined,
  locked:   false,
  lockedAt: undefined,
} as const;

async function transferUniqueAsset(
  assetType: "equipment" | "collectible",
  assetId: string,
  sellerId: string,
  buyerId: string,
): Promise<void> {
  if (assetType === "collectible") {
    const db = await connectDatabase();
    const session = await db.startSession();
    try {
      let transferred = false;
      await session.withTransaction(async () => {
        transferred = await settleCollectibleMarketplaceSale(
          assetId,
          sellerId,
          buyerId,
          session,
        );
        if (!transferred) {
          throw new Error(`COLLECTIBLE_SETTLEMENT_CONFLICT: ${assetId}`);
        }
      });
      if (!transferred) throw new Error(`COLLECTIBLE_SETTLEMENT_CONFLICT: ${assetId}`);
    } finally {
      await session.endSession();
    }
    return;
  }

  const result = await EquipmentModel.updateOne(
    { _id: assetId, owner: sellerId, "market.listed": true, "market.locked": true },
    { $set: { owner: buyerId, equipped: false, market: EMPTY_MARKET } },
  );
  if (result.modifiedCount !== 1) {
    throw new Error(`EQUIPMENT_SETTLEMENT_CONFLICT: ${assetId}`);
  }
}

// ---------------------------------------------------------------------------
// 4.4-C — Transfer stackable asset (partial fills supported)
// ---------------------------------------------------------------------------

async function transferStackableAsset(
  itemName: string,
  purchaseQty: number,
  sellerId: string,
  buyerId: string,
): Promise<void> {
  const itemDoc = await InventoryModel
    .findOne({ owner: sellerId, item: itemName })
    .lean<{ market?: { amount?: number; listed?: boolean } | null }>();

  const reservation = itemDoc?.market;
  if (!reservation || !reservation.listed || (reservation.amount ?? 0) <= 0) {
    throw new Error(
      `RESERVATION_MISSING: no active reservation for item "${itemName}" on seller ${sellerId}`,
    );
  }

  const reservedQty = reservation.amount ?? 0;
  if (reservedQty < purchaseQty) {
    throw new Error(
      `RESERVATION_INSUFFICIENT: reserved ${reservedQty} but requested ${purchaseQty}`,
    );
  }

  const fullyFilled = reservedQty - purchaseQty === 0;
  const sellerUpdate = fullyFilled
    ? { $set: { market: null } }
    : { $inc: { "market.amount": -purchaseQty } };

  const sellerResult = await InventoryModel.updateOne(
    { owner: sellerId, item: itemName, "market.amount": { $gte: purchaseQty } },
    sellerUpdate,
  );

  if (sellerResult.matchedCount === 0) {
    throw new Error(
      `RESERVATION_CONCURRENT_CONFLICT: reservation for "${itemName}" was modified concurrently`,
    );
  }

  await addItems(buyerId, { [itemName]: purchaseQty });
}

// ---------------------------------------------------------------------------
// Build step — validate the listing and return an unsigned $LFRG transaction
// ---------------------------------------------------------------------------

/**
 * Validates a listing for purchase by `buyerId` and builds the unsigned
 * on-chain payment transaction (seller payout + market fee + memo). This is a
 * read-only step — it does NOT acquire the settlement lock or mutate state.
 *
 * @throws Never — all failure states are returned as typed result variants.
 */
export async function buildPurchaseTransaction(
  buyerId: string,
  listingId: string,
  quantity?: number,
): Promise<BuildPurchaseResult> {

  // `listingId` is the embedded `market.hash` — the public listing identity. §Phase 3
  const listing = await getActiveListingByHash(listingId);
  if (!listing) return { status: "listing-not-found" };
  if (new Date(listing.expiresAt) < new Date()) return { status: "listing-expired" };
  if (listing.sellerId === buyerId) return { status: "cannot-buy-own-listing" };

  const qtyResult = resolvePurchaseQty(listing, quantity);
  if (!qtyResult.ok) return qtyResult.error;

  const amounts = computeAmounts(listing.price, qtyResult.purchaseQty);

  try {
    const tx = await createMarketplacePurchaseTransaction({
      buyerWallet: buyerId,
      sellerWallet: listing.sellerId,
      sellerNet: amounts.sellerNet,
      fee: amounts.fee,
      listingHash: listing.hash,
      assetId: listing.assetId,
      assetType: listing.assetType,
    });

    return {
      status: "ok",
      transaction: tx.transaction,
      feePayer: tx.feePayer,
      memo: tx.memo,
      listingId,
      ...amounts,
    };
  } catch (err) {
    return {
      status: "build-error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Settlement step — verify the broadcast payment and transfer the asset
// ---------------------------------------------------------------------------

/**
 * Settles a marketplace purchase after the buyer has broadcast the on-chain
 * payment. Verifies the payment (direct seller payout + market fee + memo)
 * inside the listing lock, then transfers the asset and records the trade.
 *
 * @throws Never — all failure states are returned as typed result variants.
 */
export async function settleOnChainPurchase(
  buyerId: string,
  listingId: string,
  txHash: string,
  quantity?: number,
): Promise<SettleResult> {

  // ── Step 1: Validate listing (resolved from embedded `market.hash`) ─────────
  // `listingId` is the public listing hash now that the standalone index is
  // gone. The listing is reconstructed from the asset's embedded `market`
  // sub-doc across the four tradable collections. §Phase 3
  const listing = await getActiveListingByHash(listingId);
  if (!listing) return { status: "listing-not-found" };
  if (new Date(listing.expiresAt) < new Date()) return { status: "listing-expired" };
  if (listing.sellerId === buyerId) return { status: "cannot-buy-own-listing" };

  // ── Step 2: Acquire listing lock (on the embedded market sub-doc) ──────────
  const locked = await acquireListingLock(
    listing.assetType as TradableAssetType,
    listingId,
    MARKETPLACE_CONFIG.lockTimeoutMs,
  );
  if (!locked) return { status: "listing-locked" };

  try {
    // ── Step 3: Re-read under lock + verify source-of-truth asset ─────────────
    const freshListing = await getActiveListingByHash(listingId);
    if (!freshListing) {
      return { status: "listing-not-active" };
    }

    const assetVerifyError = await verifyAssetMatchesListing(freshListing);
    if (assetVerifyError) {
      return { status: "asset-mismatch", detail: assetVerifyError };
    }

    // ── Step 4: Calculate amounts ─────────────────────────────────────────────
    const qtyResult = resolvePurchaseQty(freshListing, quantity);
    if (!qtyResult.ok) return qtyResult.error;

    const amounts = computeAmounts(freshListing.price, qtyResult.purchaseQty);
    const { purchaseQty, totalPrice, fee, sellerNet } = amounts;

    // ── Step 5: Idempotency guard (inside the lock) ───────────────────────────
    if (await isTransactionProcessed(txHash)) {
      return { status: "already-processed" };
    }

    // ── Step 6: Verify the on-chain escrow deposit ────────────────────────────
    // Escrow model: the buyer paid the FULL price into the MARKET_TEST wallet.
    const paymentValid = await verifyMarketplacePayment({
      txHash,
      buyerWallet: buyerId,
      totalPrice,
      expectedHash: freshListing.hash,
    });
    if (!paymentValid) {
      return { status: "payment-verification-failed" };
    }

    // ── Step 7: Insert processed-transaction record BEFORE transferring asset ──
    // Mirrors the egg flow: the on-chain payment already succeeded, so we claim
    // the txHash first. A concurrent duplicate throws E11000 → already-processed.
    try {
      await insertProcessedTransaction(txHash, buyerId);
    } catch (err) {
      const mongoErr = err as { code?: number };
      if (mongoErr?.code === 11000) return { status: "already-processed" };
      return {
        status: "settlement-error",
        detail: err instanceof Error ? err.message : String(err),
      };
    }

    // ── Steps 8-12: Transfer asset + record trade ───────────����─────────────────
    // The payment is irreversible past this point. Any failure here is logged as
    // CRITICAL for manual recovery — we never refund on-chain.
    try {
      // Step 8: Treasury fee accounting (the fee already moved on-chain).
      await creditTreasury(fee, "marketplace_fee").catch((treasuryErr) => {
        console.error(
          `[marketplace-transaction] Non-fatal: treasury credit failed for listing ${listingId}, ` +
            `txHash ${txHash}: ${treasuryErr instanceof Error ? treasuryErr.message : String(treasuryErr)}`,
        );
      });

      // Step 9: Transfer asset ownership / reservation.
      if (isUniqueAsset(listing.assetType)) {
        await transferUniqueAsset(
          listing.assetType as "equipment" | "collectible",
          listing.assetId,
          listing.sellerId,
          buyerId,
        );
      } else {
        await transferStackableAsset(
          listing.assetName,
          purchaseQty,
          listing.sellerId,
          buyerId,
        );
      }

      // Step 10: The listing state lives in the asset's embedded `market`
      // sub-doc, which the transfer helpers above already updated — a full fill
      // cleared it (`market: null`); a partial stackable fill decremented
      // `market.amount`. There is no separate index to update. §Phase 3

      // Step 11: Write immutable log record (marketplace_logs).
      await MarketplaceLogModel.create({
        type: "market_sale",
        listingId,
        assetType: listing.assetType,
        assetId: listing.assetId,
        assetName: listing.assetName,
        sellerId: listing.sellerId,
        buyerId,
        quantity: purchaseQty,
        price: freshListing.price,
        totalPrice,
        fee,
        sellerNet,
        completedAt: new Date(),
        // Buyer's on-chain payment signature — durable idempotency key.
        signature: txHash,
        txHash,
      });

      // Step 12: Enqueue the seller's escrow payout (their 95 % net). The escrow
      // wallet holds the full price the buyer deposited; the smart-contract
      // runtime (services/marketplace/app.ts) drains this job and transfers the
      // seller their net, keeping the fee. Durable retry/dead-letter lives in
      // the queue — a transient payout failure never blocks this response.
      await enqueuePayoutJob({
        kind: "seller_payout",
        recipient: listing.sellerId,
        amount: sellerNet,
        refSignature: txHash,
      }).catch((payoutErr) => {
        console.error(
          `[marketplace-transaction] CRITICAL: failed to enqueue seller payout for ` +
            `listing ${listingId}, txHash ${txHash}, seller ${listing.sellerId}, net ${sellerNet}. ` +
            `Manual payout required. Error: ${payoutErr instanceof Error ? payoutErr.message : String(payoutErr)}`,
        );
      });

      return { status: "ok", listingId, ...amounts };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[marketplace-transaction] CRITICAL: escrow deposit ${txHash} succeeded but asset ` +
          `settlement failed for listing ${listingId} (buyer ${buyerId}). Enqueuing buyer refund. ` +
          `Error: ${errMsg}`,
      );

      // Escrow safety net: the buyer paid into escrow but never received the
      // asset — refund their full deposit. Idempotent + durable via the queue.
      await enqueuePayoutJob({
        kind: "buyer_refund",
        recipient: buyerId,
        amount: totalPrice,
        refSignature: txHash,
      }).catch((refundErr) => {
        console.error(
          `[marketplace-transaction] CRITICAL: failed to enqueue buyer refund for ` +
            `txHash ${txHash}, buyer ${buyerId}, amount ${totalPrice}. Manual refund required. ` +
            `Error: ${refundErr instanceof Error ? refundErr.message : String(refundErr)}`,
        );
      });

      return { status: "settlement-error", detail: errMsg };
    }
  } finally {
    // ── Step 14: Always release the concurrency lock ──────────────────────────
    // No-op if the embed was already cleared by a full-fill transfer.
    await releaseListingLock(listing.assetType as TradableAssetType, listingId);
  }
}

// ---------------------------------------------------------------------------
// 4.4-E — Source-of-truth asset verification (anti-exploit §9.20)
// ---------------------------------------------------------------------------

/**
 * Verifies that the asset document's embedded `market` state still matches the
 * resolved listing view. Returns null on success or an error string on
 * mismatch. §9.20 rules #6, #7.
 */
async function verifyAssetMatchesListing(
  listing: ListingView,
): Promise<string | null> {
  const { assetType, assetId, assetName, sellerId, quantity } = listing;

  if (isUniqueAsset(assetType)) {
    if (assetType !== "equipment" && assetType !== "collectible") {
      return `Asset type ${assetType} is not tradable`;
    }
    const Model = assetType === "collectible" ? CollectibleModel : EquipmentModel;
    // Mongoose model unions do not expose compatible overloaded signatures.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asset = await (Model as any)
      .findById(assetId)
      .select("owner market")
      .lean() as { owner?: string; market?: { listed?: boolean; locked?: boolean } | null } | null;

    if (!asset) return `Asset ${assetId} (${assetType}) not found`;
    if (asset.owner !== sellerId) {
      return `Asset ${assetId} owner mismatch: expected ${sellerId}, got ${asset.owner}`;
    }
    if (!asset.market?.listed) {
      return `Asset ${assetId} is not marked as listed on the asset document`;
    }
    if (!asset.market.locked) {
      return `Asset ${assetId} is not locked for settlement`;
    }
    return null;
  }

  const itemDoc = await InventoryModel
    .findOne({ owner: sellerId, item: assetName })
    .select("market")
    .lean() as { market?: { amount?: number; listed?: boolean } | null } | null;

  if (!itemDoc) return `Seller item document not found for ${sellerId} / "${assetName}"`;

  const reservation = itemDoc.market;
  if (!reservation || !reservation.listed || (reservation.amount ?? 0) < quantity) {
    return (
      `Reservation for "${assetName}" has only ${reservation?.amount ?? 0} ` +
      `units, but listing claims ${quantity}`
    );
  }

  return null;
}

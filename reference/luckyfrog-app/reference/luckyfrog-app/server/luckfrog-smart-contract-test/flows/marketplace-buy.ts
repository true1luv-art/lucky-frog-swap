/**
 * server/luckfrog-smart-contract-test/flows/marketplace-buy.ts
 *
 * The MARKETPLACE-BUY settlement flow (fee + seller net, NO refund on success).
 *
 * Registered against the router's `transaction` route. When the watcher detects
 * an inbound $LFRG deposit into the market/escrow wallet carrying a
 * `tm_purchase-<hash>` memo, this handler:
 *
 *   1. Resolves `<hash>` → the owning asset document by scanning the embedded
 *      `market` sub-docs across the four tradable collections (Phase 3 query
 *      layer). No `marketplace_listings` index is involved.
 *   2. Derives the purchase quantity from the ACTUAL on-chain deposit
 *      (`transfer.tokenAmount / listing.price`) — the memo is routing-only.
 *   3. Delegates to the shared, idempotent settlement engine
 *      (`settleOnChainPurchase`), which — inside a per-listing lock —
 *      re-verifies the on-chain payment, claims the signature in
 *      `transactions_processed`, transfers the asset, writes the
 *      `marketplace_logs` sale record, credits the treasury fee, notifies the
 *      seller, and enqueues the seller's `sellerNet` payout (fee stays in the
 *      market wallet). A buyer refund is enqueued ONLY if settlement fails
 *      AFTER the irreversible on-chain payment.
 *
 * The seller payout / buyer refund jobs are drained by `settlement/consumer.ts`.
 *
 * Idempotency: the watcher dedups per signature and `settleOnChainPurchase`
 * inserts `transactions_processed` before any transfer, so re-delivery of the
 * same signature is a no-op (`already-processed`).
 */
import {
  registerHandler,
  type TransferContext,
  type RouteOutcome,
} from "../router/handle-transaction";
import { log } from "../lib/logger";
import { getActiveListingByHash } from "@/lib/modules/marketplace/query.server";
import { settleOnChainPurchase } from "@/lib/modules/marketplace/transaction.server";

/**
 * Handles one classified `transaction` transfer and reports a
 * {@link RouteOutcome} so the durable ingest consumer can delete (terminal) or
 * retry (transient) the `transactions_pending` queue row. Never throws — all settlement
 * failure modes are typed results.
 */
async function handleMarketSale(ctx: TransferContext): Promise<RouteOutcome> {
  const { transfer, decision } = ctx;

  if (decision.parsed?.kind !== "transaction") {
    log.warn(
      `market-buy: transfer ${transfer.signature} routed as transaction but ` +
        `memo did not parse as a market memo — dropping.`,
    );
    return "dropped";
  }

  const listingHash = decision.parsed.hash;
  const buyer = transfer.sender;
  const totalPaid = transfer.tokenAmount;

  // Resolve the listing from the embedded `market` sub-doc to derive quantity.
  const listing = await getActiveListingByHash(listingHash);
  if (!listing) {
    log.info(
      `market-buy: no active listing for hash ${listingHash} (sig ${transfer.signature}) — ` +
        `already settled, cancelled, or expired. Dropping.`,
    );
    return "dropped";
  }

  // Quantity comes from the ACTUAL on-chain deposit, not the memo. For unique
  // assets this resolves to 1; `settleOnChainPurchase` re-verifies the payment
  // amount on-chain, so a spoofed deposit fails verification safely.
  const qty =
    listing.price > 0 ? Math.max(1, Math.round(totalPaid / listing.price)) : 1;

  const result = await settleOnChainPurchase(
    buyer,
    listingHash,
    transfer.signature,
    qty,
  );

  switch (result.status) {
    case "ok":
      log.info(
        `market-buy: SETTLED listing ${listingHash} for ${buyer} — ` +
          `qty ${result.purchaseQty}, total ${result.totalPrice} $LFRG ` +
          `(sellerNet ${result.sellerNet}, fee ${result.fee}) (sig ${transfer.signature}). ` +
          `Seller payout enqueued.`,
      );
      return "settled";

    case "already-processed":
      log.info(
        `market-buy: signature ${transfer.signature} already processed — no-op.`,
      );
      return "settled";

    // Terminal rejections — the on-chain / listing state will never change.
    case "listing-not-found":
    case "listing-not-active":
    case "listing-expired":
    case "cannot-buy-own-listing":
    case "asset-mismatch":
    case "invalid-quantity":
    case "quantity-exceeds-available":
    case "payment-verification-failed":
      log.warn(
        `market-buy: listing ${listingHash} rejected (${result.status}) ` +
          `(sig ${transfer.signature}) — dropping.`,
      );
      return "dropped";

    // A concurrent settlement holds the lock, or settlement failed after
    // payment (a buyer refund was enqueued by the engine). Keep the queue row
    // and re-attempt on the next drain so a locked listing settles on a
    // subsequent pass (dead-lettered after the consumer's retry budget).
    case "listing-locked":
    case "settlement-error":
    default:
      log.error(
        `market-buy: listing ${listingHash} settlement transient failure ` +
          `(${result.status}) (sig ${transfer.signature}).`,
      );
      return "retry";
  }
}

/** Registers the marketplace-buy flow with the router. Called once at boot. */
export function registerMarketplaceBuyFlow(): void {
  registerHandler("transaction", handleMarketSale);
  log.info("Registered marketplace-buy flow (transaction).");
}

/**
 * server/farm-smart-contract/workers/transaction-worker.ts
 *
 * Single worker that drains `transactions_pending` on a recurring cycle.
 *
 * The frontend creates a pending row for every player-initiated transaction:
 *   "marketplace_purchase" → settle the trade (debit buyer, credit seller, transfer item)
 *
 * Note: deposit and withdrawal branches have been removed. The bank / coin
 * withdrawal system is no longer part of the game. The queue and worker are
 * kept for marketplace settlement only.
 *
 * Flow per cycle:
 *   1. Snapshot all pending/failed rows oldest-first.
 *   2. Process each row sequentially (prevents double-spend on same listing).
 *   3. completeJob (delete) on success or deterministic non-ok result.
 *   4. failJob (retry → dead-letter after maxRetries) on transient errors.
 *
 * Clients learn about completed transactions by polling GET /api/transactions.
 */

import {
  listPendingOldestFirst,
  completeJob,
  failJob,
  countJobsByStatus,
} from "../../../lib/modules/transactions-pending/repository.server";
import { settlePurchase } from "../../../lib/modules/listings/repository.server";
import { log }           from "../lib/logger";

const POLL_INTERVAL = 5_000; // ms between drain cycles

let timer:      ReturnType<typeof setTimeout> | null = null;
let processing = false;

async function drain(): Promise<void> {
  const rows = await listPendingOldestFirst(0);
  if (rows.length === 0) return;

  log.info("tx-worker", `Draining ${rows.length} pending row(s)`);

  for (const row of rows) {
    const { _id, type } = row;

    // ── Marketplace purchase ──────────────────────────────────────────────────
    if (type === "marketplace_purchase") {
      try {
        if (!row.listingId || !row.buyerWallet) {
          throw new Error("marketplace_purchase row missing listingId or buyerWallet");
        }
        if (!row.signature) {
          throw new Error("marketplace_purchase row missing buyer payment hash (signature)");
        }

        const result = await settlePurchase({
          listingId:   row.listingId,
          buyerWallet: row.buyerWallet,
          quantity:    row.quantity,
          buyerTxHash: row.signature,
          paidTotal:   row.tokenAmount ?? 0,
        });

        await completeJob(_id);

        if (result.status === "ok") {
          log.info("tx-worker", "Marketplace purchase settled", {
            listingId:  result.listingId,
            buyer:      row.buyerWallet,
            totalPrice: result.totalPrice,
          });
        } else {
          // Deterministic non-ok (sold out, insufficient balance, etc.) — no retry.
          log.warn("tx-worker", "Marketplace purchase non-ok (no retry)", {
            listingId: row.listingId.toString(),
            buyer:     row.buyerWallet,
            status:    result.status,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const dead    = await failJob(_id, message);
        log.warn("tx-worker", `Marketplace purchase failed — ${dead ? "DEAD-LETTERED" : "will retry"}`, {
          listingId: row.listingId?.toString(),
          buyer:     row.buyerWallet,
          error:     message,
        });
      }
      continue;
    }

    log.warn("tx-worker", `Unknown transaction type — skipping`, { id: _id, type });
  }
}

async function cycle(): Promise<void> {
  if (!processing) {
    processing = true;
    try {
      await drain();
    } catch (err) {
      log.error("tx-worker", "Drain cycle error", err);
    } finally {
      processing = false;
    }
  }
  timer = setTimeout(cycle, POLL_INTERVAL);
}

export function startTransactionWorker(): void {
  log.info("tx-worker", `Starting transaction worker (poll every ${POLL_INTERVAL / 1000}s)`);

  countJobsByStatus()
    .then((counts) => log.info("tx-worker", "Boot queue stats", counts))
    .catch(() => { /* non-fatal */ });

  timer = setTimeout(cycle, 2_000);
}

export function stopTransactionWorker(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

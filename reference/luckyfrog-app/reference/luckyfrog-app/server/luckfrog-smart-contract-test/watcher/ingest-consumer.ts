/**
 * server/luckfrog-smart-contract-test/watcher/ingest-consumer.ts
 *
 * The INBOUND ingest consumer — the drain half of the durable inbound queue,
 * the LuckyFrog analogue of TerraCore's `sendTransactions` loop over the
 * `transactions_pending` collection.
 *
 * Producer / consumer split:
 *   PRODUCER  the watcher (`ws-listener.ts`) records every detected $LFRG
 *             deposit into the `transactions_pending` collection via
 *             `enqueueInboundTransfer` — it never settles inline.
 *   CONSUMER  THIS loop drains `transactions_pending` oldest-first (chain order),
 *             reconstructs the {@link InboundTransfer}, and routes it through
 *             the shared `handleTransaction` router. The router returns a
 *             {@link RouteOutcome}:
 *               - "settled" / "dropped" → terminal: delete the queue row.
 *               - "retry"               → transient: keep the row, re-attempt
 *                                          next drain (dead-lettered after N).
 *
 * The permanent "finished/granted" record lives in `transactions_processed`
 * (written by the settlement services before any grant), so deleting the queue
 * row on completion never risks a double-grant on re-delivery.
 *
 * This is deliberately symmetric with the OUTBOUND payout consumer
 * (`settlement/consumer.ts`): same poll cadence, batch, back-off, and
 * dead-letter contract.
 */
import { connectDatabase } from "@/lib/config/database";
import { log } from "../lib/logger";
import { handleTransaction } from "../router/handle-transaction";
import type { InboundTransfer } from "./tx-parser";
import {
  listPendingOldestFirst,
  completeJob,
  failJob,
  countJobsByStatus,
} from "@/lib/modules/transactions-pending/repository.server";
import type { IInboundTransaction } from "@/lib/modules/transactions-pending/types.server";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How often the drain loop runs. */
const DRAIN_INTERVAL_MS = 1_000;

/** Max rows pulled per drain cycle. */
const DRAIN_BATCH = 25;

/** Small gap between sequential settlements to stay within RPC rate limits. */
const SETTLE_GAP_MS = 150;

/** Processing attempts before a row is dead-lettered. */
const MAX_RETRIES = 8;

/** Guards against overlapping drain cycles. */
let isDraining = false;

// ---------------------------------------------------------------------------
// Row → InboundTransfer
// ---------------------------------------------------------------------------

/** Rebuilds the normalized transfer the router expects from a queue row. */
function rowToTransfer(row: IInboundTransaction): InboundTransfer {
  return {
    signature: row.signature,
    sender: row.sender,
    tokenAmount: row.tokenAmount,
    rawAmount: BigInt(row.rawAmount),
    memo: row.memo,
    blockTime: row.blockTime,
  };
}

// ---------------------------------------------------------------------------
// Drain loop
// ---------------------------------------------------------------------------

async function drainQueue(): Promise<void> {
  if (isDraining) return;
  isDraining = true;

  try {
    const rows = await listPendingOldestFirst(DRAIN_BATCH);
    if (rows.length === 0) return;

    for (const row of rows) {
      const rowId = String(row._id);
      try {
        const outcome = await handleTransaction(rowToTransfer(row));

        if (outcome === "retry") {
          const dead = await failJob(
            rowId,
            `transient outcome for ${row.signature}`,
            MAX_RETRIES,
          );
          log.warn(
            `ingest: transfer ${row.signature} transient — ${dead ? "dead-lettered" : "will retry"}.`,
          );
        } else {
          // "settled" or "dropped" — both terminal for the queue.
          await completeJob(rowId);
        }
      } catch (err) {
        // handleTransaction is designed not to throw; treat any escape as
        // transient so the row is retried / dead-lettered rather than lost.
        const msg = err instanceof Error ? err.message : String(err);
        const dead = await failJob(rowId, msg, MAX_RETRIES);
        log.warn(
          `ingest: transfer ${row.signature} threw (${msg}) — ${dead ? "dead-lettered" : "will retry"}.`,
        );
      }

      await new Promise((r) => setTimeout(r, SETTLE_GAP_MS));
    }
  } catch (err) {
    log.error("Ingest drain loop error:", err);
  } finally {
    isDraining = false;
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/**
 * Boots the inbound ingest consumer: connects to Mongo, reports any leftover
 * rows, and starts the periodic drain loop. Safe to call once at startup.
 */
export async function startIngestConsumer(): Promise<void> {
  await connectDatabase();

  try {
    const counts = await countJobsByStatus();
    log.info(
      `Inbound queue on startup — pending: ${counts.pending}, failed: ${counts.failed}, dead: ${counts.dead}`,
    );
  } catch {
    /* non-fatal */
  }

  log.info(`Inbound ingest consumer started — draining every ${DRAIN_INTERVAL_MS}ms.`);

  setInterval(() => {
    drainQueue().catch((err) => {
      log.error("Ingest drain loop error:", err);
    });
  }, DRAIN_INTERVAL_MS);
}

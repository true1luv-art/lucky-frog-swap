/**
 * server/luckfrog-smart-contract-test/settlement/consumer.ts
 *
 * The OUTBOUND payout consumer — the drain half of the escrow settlement loop,
 * ported from `services/marketplace/app.ts`.
 *
 * In the consolidated runtime the inbound side settles INLINE in the flow
 * handlers (`flows/marketplace-buy.ts` calls `settleOnChainPurchase`), which
 * enqueues an outbound payout job:
 *   - `seller_payout` on a successful sale (the seller's `sellerNet`), and
 *   - `buyer_refund`  only when settlement fails AFTER the irreversible payment.
 *
 * This consumer drains those outbound jobs oldest-first (chain order) and moves
 * $LFRG out of the market/escrow wallet via `settlePayoutJob`. The 5 % fee is
 * never paid out — it simply stays in the market wallet. There is NO refund on a
 * successful sale.
 *
 * Idempotency: the queue's unique job signature (`<kind>:<refSignature>`)
 * prevents duplicate jobs; the payout ledger inside `settlePayoutJob` prevents
 * re-paying a job that already completed in a prior drain cycle.
 */
import { connectDatabase } from "@/lib/config/database";
import { log } from "../lib/logger";
import { settlePayoutJob } from "./escrow";
import {
  listPendingOldestFirst,
  completeJob,
  failJob,
  countJobsByStatus,
  type IMarketplaceSettlementJob,
} from "./queue";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How often the drain loop runs. */
const DRAIN_INTERVAL_MS = 2_000;

/** Max jobs pulled per drain cycle. */
const DRAIN_BATCH = 25;

/** Small gap between sequential payouts to stay within RPC rate limits. */
const SETTLE_GAP_MS = 250;

/** Payout retries before a job is dead-lettered. */
const MAX_RETRIES = 8;

/** Guards against overlapping drain cycles. */
let isDraining = false;

// ---------------------------------------------------------------------------
// Drain loop
// ---------------------------------------------------------------------------

/** Outbound payout kinds this consumer settles. */
const PAYOUT_KINDS = new Set(["seller_payout", "buyer_refund"]);

async function drainQueue(): Promise<void> {
  if (isDraining) return;
  isDraining = true;

  try {
    const jobs = await listPendingOldestFirst(DRAIN_BATCH);
    if (jobs.length === 0) return;

    for (const job of jobs) {
      // Inbound (market / egg) jobs settle inline in the flow handlers, so this
      // consumer only owns the outbound payout legs. Rows without a `kind`
      // (raw inbound deposits) and non-payout kinds are skipped and left for
      // their own handler.
      if (!job.kind || !PAYOUT_KINDS.has(job.kind)) continue;

      const jobId = String(job._id);
      try {
        await settleEscrowPayoutJob(job, jobId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const dead = await failJob(jobId, msg, MAX_RETRIES);
        log.warn(
          `Payout job ${job.signature} threw (${msg}) — ${dead ? "dead-lettered" : "will retry"}.`,
        );
      }

      await new Promise((r) => setTimeout(r, SETTLE_GAP_MS));
    }
  } catch (err) {
    log.error("Drain loop error:", err);
  } finally {
    isDraining = false;
  }
}

/**
 * Settles one outbound escrow payout job (seller net or buyer refund) by
 * transferring $LFRG OUT of the market wallet to the recipient. The payout
 * ledger makes this idempotent; a thrown error is transient and is retried /
 * dead-lettered by the caller.
 */
async function settleEscrowPayoutJob(
  job: IMarketplaceSettlementJob,
  jobId: string,
): Promise<void> {
  const kind = job.kind as "seller_payout" | "buyer_refund";
  const recipient = job.recipient;

  if (!recipient) {
    log.error(`Payout job ${job.signature} missing recipient — dropping.`);
    await completeJob(jobId);
    return;
  }

  // job.signature is already the synthetic `<kind>:<refSignature>` key.
  const amount = job.totalPaid ?? 0;
  const result = await settlePayoutJob(job.signature, kind, recipient, amount);

  if (result.status === "ok") {
    log.info(
      `PAID ${kind}: ${amount} $LFRG → ${recipient} (payout sig: ${result.signature})`,
    );
  } else {
    log.info(`Payout ${job.signature} already paid — dropping.`);
  }
  await completeJob(jobId);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/**
 * Boots the payout consumer: connects to Mongo, reports any leftover jobs, and
 * starts the periodic drain loop. Safe to call once at startup.
 */
export async function startConsumer(): Promise<void> {
  await connectDatabase();

  try {
    const counts = await countJobsByStatus();
    log.info(
      `Settlement queue on startup — pending: ${counts.pending}, failed: ${counts.failed}, dead: ${counts.dead}`,
    );
  } catch {
    /* non-fatal */
  }

  log.info(`Payout consumer started — draining every ${DRAIN_INTERVAL_MS}ms.`);

  setInterval(() => {
    drainQueue().catch((err) => {
      log.error("Drain loop error:", err);
    });
  }, DRAIN_INTERVAL_MS);
}

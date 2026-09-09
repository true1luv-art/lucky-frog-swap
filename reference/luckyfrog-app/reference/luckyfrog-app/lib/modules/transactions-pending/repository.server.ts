/**
 * lib/modules/transactions-pending/repository.server.ts
 *
 * Repository for the durable work queue (`transactions_pending` collection).
 * This collection now holds TWO kinds of work (see ./model.server.ts):
 *   - INBOUND rows  — detected $LFRG deposits, enqueued by the watcher.
 *   - PAYOUT rows   — outbound escrow transfers (seller payouts / buyer
 *                     refunds), enqueued by the settlement services via
 *                     {@link enqueuePayoutJob}.
 *
 * Producer / consumer split (see server/luckfrog-smart-contract-test):
 *   PRODUCER  the watcher parses each new market-ATA deposit and calls
 *             {@link enqueueInboundTransfer}; the settlement services enqueue
 *             outbound payout jobs via {@link enqueuePayoutJob}.
 *   CONSUMER  the ingest consumer drains inbound rows oldest-first via
 *             {@link listPendingOldestFirst}, routes each row through
 *             `handleTransaction`, then {@link completeJob} (terminal:
 *             settled or dropped) or {@link failJob} (transient — retry
 *             with dead-letter after maxRetries). The settlement consumer
 *             drains payout rows through the same functions.
 *
 * The `signature` field carries a UNIQUE index, so both enqueue paths are
 * upsert-ignore-dupe: an inbound deposit seen twice, or a payout job derived
 * from the same purchase, only ever creates one row. For payout rows the
 * signature is a SYNTHETIC key of the form `` `${kind}:${refSignature}` ``.
 * Combined with the `transactions_processed` guard inside the settlement
 * services, double-settlement is impossible regardless of ordering.
 */

import mongoose from "mongoose";
import { InboundTransactionModel } from "./model.server";
import type { IInboundTransaction, InboundTxStatus } from "./types.server";

/** Fields required to enqueue a detected inbound transfer. */
export interface EnqueueInboundInput {
  signature: string;
  sender: string;
  tokenAmount: number;
  /** Raw on-chain units as bigint (serialized to string for storage). */
  rawAmount: bigint;
  memo: string | null;
  /** Chain block time (unix seconds). Defaults to now when unknown. */
  blockTime?: number;
}

/**
 * Enqueues a detected inbound transfer, ignoring duplicates.
 *
 * Uses an upsert keyed on the unique `signature` with `$setOnInsert`, so a
 * signature that is already queued (or was inserted concurrently) is a no-op
 * rather than an error. Returns true when a new row was created, false when the
 * signature was already present.
 */
export async function enqueueInboundTransfer(
  input: EnqueueInboundInput,
): Promise<boolean> {

  const res = await InboundTransactionModel.updateOne(
    { signature: input.signature },
    {
      $setOnInsert: {
        type:        "transaction",
        signature: input.signature,
        sender:      input.sender,
        tokenAmount: input.tokenAmount,
        rawAmount:   input.rawAmount.toString(),
        memo:        input.memo,
        blockTime:   input.blockTime ?? Math.floor(Date.now() / 1000),
        status:      "pending",
        retryCount:  0,
      },
    },
    { upsert: true },
  ).catch((err: unknown) => {
    // A racing upsert can still surface E11000 — treat it as "already queued".
    const mongoErr = err as { code?: number };
    if (mongoErr?.code === 11000) return { upsertedCount: 0 };
    throw err;
  });

  return (res.upsertedCount ?? 0) > 0;
}

/** Fields required to enqueue an outbound escrow payout job. */
export interface EnqueuePayoutInput {
  kind: "seller_payout" | "buyer_refund";
  /** Wallet that receives the transfer (seller net, or buyer refund). */
  recipient: string;
  /** $LFRG amount (human units) to transfer out of the escrow wallet. */
  amount: number;
  /** The settled purchase signature this payout derives from (idempotency). */
  refSignature: string;
  /** Chain time to order the drain by; defaults to now. */
  blockTime?: number;
}

/**
 * Enqueues an outbound escrow payout (seller net or buyer refund) into the same
 * `transactions_pending` collection, ignoring duplicates. The unique row
 * `signature` is the synthetic key `<kind>:<refSignature>`, so a seller payout /
 * buyer refund for a given purchase is only ever queued once even if settlement
 * is retried.
 *
 * Payout rows carry `rawAmount: "0"` and `tokenAmount: 0` (the escrow transfer
 * amount lives in `totalPaid`) and set the routing fields (`kind`, `recipient`,
 * `refSignature`) that the settlement consumer reads.
 *
 * Returns true when a new row was created, false when it already existed.
 */
export async function enqueuePayoutJob(input: EnqueuePayoutInput): Promise<boolean> {

  const signature = `${input.kind}:${input.refSignature}`;
  const res = await InboundTransactionModel.updateOne(
    { signature },
    {
      $setOnInsert: {
        type:          "transaction",
        signature,
        kind:         input.kind,
        sender:       input.recipient, // schema-required; the payee for payouts
        recipient:    input.recipient,
        refSignature: input.refSignature,
        tokenAmount:  0,
        rawAmount:    "0",
        memo:         null,
        totalPaid:    input.amount,
        blockTime:    input.blockTime ?? Math.floor(Date.now() / 1000),
        status:       "pending",
        retryCount:   0,
      },
    },
    { upsert: true },
  ).catch((err: unknown) => {
    // A racing upsert can still surface E11000 — treat it as "already queued".
    const mongoErr = err as { code?: number };
    if (mongoErr?.code === 11000) return { upsertedCount: 0 };
    throw err;
  });

  return (res.upsertedCount ?? 0) > 0;
}

/**
 * Returns the oldest pending/failed rows (chain order) for the consumer to
 * drain, capped at `limit`. Dead-lettered rows are excluded.
 */
export async function listPendingOldestFirst(
  limit = 25,
): Promise<IInboundTransaction[]> {

  return InboundTransactionModel
    .find({ status: { $in: ["pending", "failed"] } })
    .sort({ blockTime: 1, createdAt: 1 })
    .limit(limit)
    .lean<IInboundTransaction[]>();
}

/**
 * Removes a row from the queue after a TERMINAL outcome (settled ok, already
 * processed, or a non-retryable drop). The permanent record lives in
 * `transactions_processed` and on-chain, so the queue row is simply deleted.
 */
export async function completeJob(
  id: mongoose.Types.ObjectId | string,
): Promise<void> {
  await InboundTransactionModel.deleteOne({ _id: id });
}

/**
 * Records a transient failure. Increments `retryCount` and stores the error.
 * Once `retryCount` reaches `maxRetries` the row is dead-lettered
 * (`status: "dead"`) so the consumer stops picking it up but an operator can
 * still inspect it. Otherwise it is marked `failed` and retried next drain.
 *
 * @returns true if the row was dead-lettered, false if it will be retried.
 */
export async function failJob(
  id: mongoose.Types.ObjectId | string,
  errorMessage: string,
  maxRetries = 8,
): Promise<boolean> {

  const row = await InboundTransactionModel.findById(id).select("retryCount");
  const nextRetry = (row?.retryCount ?? 0) + 1;
  const dead = nextRetry >= maxRetries;

  await InboundTransactionModel.updateOne(
    { _id: id },
    {
      $set: {
        status: dead ? "dead" : "failed",
        lastError: errorMessage.slice(0, 500),
      },
      $inc: { retryCount: 1 },
    },
  );

  return dead;
}

/** Counts rows by status — used by the consumer's startup / heartbeat logging. */
export async function countJobsByStatus(): Promise<Record<InboundTxStatus, number>> {

  const rows = await InboundTransactionModel.aggregate<{ _id: InboundTxStatus; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const out: Record<InboundTxStatus, number> = { pending: 0, failed: 0, dead: 0 };
  for (const row of rows) out[row._id] = row.count;
  return out;
}

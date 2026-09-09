/**
 * lib/modules/transactions-pending/repository.server.ts
 *
 * Work queue for all player-initiated transactions.
 *
 * Producers (Next.js API routes):
 *   enqueueDeposit            — player confirmed their on-chain deposit tx
 *   enqueueWithdrawal         — player requests a $HFARM payout
 *   enqueueMarketplacePurchase — player buys a marketplace listing
 *
 * Consumer (transaction-worker sidecar):
 *   listPendingOldestFirst    — snapshot-drain cycle
 *   completeJob               — delete row on success
 *   failJob                   — increment retry / dead-letter on failure
 *   countJobsByStatus         — startup / heartbeat logging
 */

import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { InboundTransactionModel } from "./model.server";
import type { IInboundTransaction, InboundTxStatus } from "./types.server";

// ---------------------------------------------------------------------------
// Deposit
// ---------------------------------------------------------------------------

export interface EnqueueDepositInput {
  /** On-chain transaction hash — acts as the idempotency key. */
  txHash:      string;
  /** On-chain sender address (player's wallet). */
  sender:      string;
  tokenAmount: number;
  rawAmount:   bigint;
  memo?:       string | null;
  blockTime?:  number;
}

/**
 * Enqueues a player-submitted deposit for verification and coin credit.
 * Upsert-ignore-dup: submitting the same txHash twice is a no-op.
 * Returns true when a new row was created.
 */
export async function enqueueDeposit(input: EnqueueDepositInput): Promise<boolean> {
  const res = await InboundTransactionModel.updateOne(
    { signature: input.txHash },
    {
      $setOnInsert: {
        type:        "deposit",
        signature:   input.txHash,
        sender:      input.sender,
        tokenAmount: input.tokenAmount,
        rawAmount:   input.rawAmount.toString(),
        memo:        input.memo ?? null,
        blockTime:   input.blockTime ?? Math.floor(Date.now() / 1000),
        status:      "pending",
        retryCount:  0,
      },
    },
    { upsert: true },
  ).catch((err: unknown) => {
    const mongoErr = err as { code?: number };
    if (mongoErr?.code === 11000) return { upsertedCount: 0 };
    throw err;
  });

  return (res.upsertedCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Withdrawal
// ---------------------------------------------------------------------------

export interface EnqueueWithdrawalInput {
  walletAddress:  string;
  withdrawAmount: number;
}

/**
 * Enqueues a player withdrawal request.
 * Returns the newly created job document.
 */
export async function enqueueWithdrawal(
  input: EnqueueWithdrawalInput,
): Promise<IInboundTransaction> {
  return InboundTransactionModel.create({
    type:           "withdrawal",
    signature:      randomUUID(),
    walletAddress:  input.walletAddress,
    withdrawAmount: input.withdrawAmount,
    status:         "pending",
    retryCount:     0,
  });
}

// ---------------------------------------------------------------------------
// Marketplace purchase
// ---------------------------------------------------------------------------

export interface EnqueueMarketplacePurchaseInput {
  listingId:   mongoose.Types.ObjectId;
  buyerWallet: string;
  quantity:    number;
  /**
   * On-chain tx hash of the buyer's HFARM payment to the treasury.
   * Doubles as the idempotency key (unique `signature`) so the same paid
   * purchase can never be queued twice.
   */
  buyerTxHash: string;
  /** Total price (whole/decimal HFARM) the buyer paid — used for on-chain refunds. */
  totalPrice:  number;
}

/**
 * Enqueues a marketplace purchase for processing by the transaction-worker.
 * The buyer has already paid the treasury on-chain (buyerTxHash); the worker
 * settles by paying the seller and transferring the item.
 * Returns the newly created job document.
 */
export async function enqueueMarketplacePurchase(
  input: EnqueueMarketplacePurchaseInput,
): Promise<IInboundTransaction> {
  return InboundTransactionModel.create({
    type:        "marketplace_purchase",
    signature:   input.buyerTxHash,
    sender:      input.buyerWallet,
    buyerWallet: input.buyerWallet,
    listingId:   input.listingId,
    quantity:    input.quantity,
    tokenAmount: input.totalPrice,
    status:      "pending",
    retryCount:  0,
  });
}

// ---------------------------------------------------------------------------
// Consumer helpers
// ---------------------------------------------------------------------------

/**
 * Returns pending/failed rows sorted oldest-first.
 * Pass limit=0 (default) to fetch the full snapshot.
 */
export async function listPendingOldestFirst(
  limit = 0,
): Promise<IInboundTransaction[]> {
  return InboundTransactionModel
    .find({ status: { $in: ["pending", "failed"] } })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean<IInboundTransaction[]>();
}

/**
 * Removes a row from the queue after a terminal outcome.
 * The permanent record lives in transactions_processed.
 */
export async function completeJob(
  id: mongoose.Types.ObjectId | string,
): Promise<void> {
  await InboundTransactionModel.deleteOne({ _id: id });
}

/**
 * Records a transient failure. Dead-letters the row after maxRetries.
 * Returns true if dead-lettered.
 */
export async function failJob(
  id:           mongoose.Types.ObjectId | string,
  errorMessage: string,
  maxRetries  = 8,
): Promise<boolean> {
  const row       = await InboundTransactionModel.findById(id).select("retryCount");
  const nextRetry = (row?.retryCount ?? 0) + 1;
  const dead      = nextRetry >= maxRetries;

  await InboundTransactionModel.updateOne(
    { _id: id },
    {
      $set: { status: dead ? "dead" : "failed", lastError: errorMessage.slice(0, 500) },
      $inc: { retryCount: 1 },
    },
  );

  return dead;
}

/** Counts rows by status — used for startup / heartbeat logging. */
export async function countJobsByStatus(): Promise<Record<InboundTxStatus, number>> {
  const rows = await InboundTransactionModel.aggregate<{
    _id: InboundTxStatus;
    count: number;
  }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]);

  const out: Record<InboundTxStatus, number> = { pending: 0, failed: 0, dead: 0 };
  for (const row of rows) out[row._id] = row.count;
  return out;
}

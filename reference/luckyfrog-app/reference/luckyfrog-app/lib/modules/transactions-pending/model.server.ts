/**
 * lib/modules/transactions-pending/model.server.ts
 *
 * Durable work queue for the on-chain watcher runtime
 * (`server/luckfrog-smart-contract-test`). This is the LuckyFrog analogue of
 * TerraCore's `transactions` collection. It holds TWO kinds of work in one
 * collection:
 *   1. INBOUND rows  — every detected $LFRG deposit, written by the watcher and
 *                      drained by the ingest consumer, which routes each row to
 *                      its settlement flow. These rows use only the core fields
 *                      (`sender`, `tokenAmount`, `rawAmount`, `memo`, ...).
 *   2. PAYOUT rows   — outbound escrow transfers (seller payouts / buyer refunds)
 *                      enqueued by the settlement services and drained by the
 *                      settlement consumer. These rows additionally set the
 *                      optional routing fields (`kind`, `recipient`,
 *                      `refSignature`, `totalPaid`, ...).
 *
 * Two-collection model (matches TerraCore):
 *   - `transactions_pending`    — THIS collection: work still to process (both
 *                                 kinds). Rows are DELETED once finished.
 *   - `transactions_processed`  — the permanent "finished/granted" ledger that
 *                                 enforces exactly-once at grant time.
 *
 * Durability: the watcher persists a transfer here BEFORE any settlement, so a
 * crash between chain-detection and settlement never loses the deposit — the
 * consumer picks it up on the next drain, independent of the Helius rescan
 * window. The unique `signature` index makes enqueue idempotent (a re-scanned
 * or re-delivered transfer only ever creates one row).
 */

import mongoose, { Schema, Model } from "mongoose";
import type {
  IInboundTransaction,
  InboundTxStatus,
  SettlementKind,
} from "./types.server";

export type {
  IInboundTransaction,
  InboundTxStatus,
  SettlementKind,
  TransactionType,
} from "./types.server";

const InboundTransactionSchema = new Schema<IInboundTransaction>(
  {
    type: {
      type: String,
      enum: ["transaction", "stash"],
      required: true,
      default: "transaction",
    },
    signature:  { type: String, required: true, unique: true },
    sender:     { type: String, required: true },
    tokenAmount:{ type: Number, required: true },
    rawAmount:  { type: String, required: true },
    memo:       { type: String, default: null },
    blockTime:  { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "failed", "dead"],
      required: true,
      default: "pending",
    },
    retryCount: { type: Number, required: true, default: 0 },
    lastError:  { type: String, default: undefined },

    // Payout-row routing fields (optional; unset on raw inbound rows).
    kind: {
      type: String,
      enum: ["seller_payout", "buyer_refund"],
      default: undefined,
    },
    recipient:    { type: String, default: undefined },
    refSignature: { type: String, default: undefined },
    totalPaid:    { type: Number, default: undefined },
  },
  {
    collection: "transactions_pending",
    timestamps: true, // createdAt, updatedAt
  },
);

/**
 * Drain index: the consumer queries `{ status: { $in: ["pending","failed"] } }`
 * sorted by `blockTime` ascending so deposits settle in chain order.
 */
InboundTransactionSchema.index({ status: 1, blockTime: 1, createdAt: 1 });

export const InboundTransactionModel: Model<IInboundTransaction> =
  mongoose.models.InboundTransaction ??
  mongoose.model<IInboundTransaction>(
    "InboundTransaction",
    InboundTransactionSchema,
  );

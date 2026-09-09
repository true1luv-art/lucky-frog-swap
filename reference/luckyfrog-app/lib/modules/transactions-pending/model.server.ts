/**
 * lib/modules/transactions-pending/model.server.ts
 *
 * Durable work queue for all player-initiated transactions.
 * The frontend creates a pending row; the transaction-worker processes it.
 *
 *   type == "deposit"              → player sent $HFARM on-chain; credit coins
 *   type == "withdrawal"           → player requests $HFARM payout; debit coins + send on-chain
 *   type == "marketplace_purchase" → player buys a listing; settle the trade
 */

import mongoose, { Schema, Model } from "mongoose";
import type { IInboundTransaction, InboundTxStatus, TransactionType } from "./types.server";

export type { IInboundTransaction, InboundTxStatus, TransactionType } from "./types.server";

const InboundTransactionSchema = new Schema<IInboundTransaction>(
  {
    type: {
      type:     String,
      enum:     ["deposit", "withdrawal", "marketplace_purchase"],
      required: true,
    },
    signature:   { type: String, required: true, unique: true },

    // deposit fields
    sender:      { type: String, default: "" },
    tokenAmount: { type: Number, default: 0 },
    rawAmount:   { type: String, default: "0" },
    memo:        { type: String, default: null },
    blockTime:   { type: Number, default: 0 },

    // withdrawal fields
    walletAddress:  { type: String },
    withdrawAmount: { type: Number },

    // marketplace_purchase fields
    listingId:   { type: Schema.Types.ObjectId },
    buyerWallet: { type: String },
    quantity:    { type: Number },

    status: {
      type:     String,
      enum:     ["pending", "failed", "dead"],
      required: true,
      default:  "pending",
    },
    retryCount: { type: Number, required: true, default: 0 },
    lastError:  { type: String },
  },
  {
    collection: "transactions_pending",
    timestamps: true,
  },
);

// Drain index: worker queries { status: { $in: ["pending","failed"] } } oldest-first.
InboundTransactionSchema.index({ status: 1, createdAt: 1 });

export const InboundTransactionModel: Model<IInboundTransaction> =
  mongoose.models.InboundTransaction ??
  mongoose.model<IInboundTransaction>("InboundTransaction", InboundTransactionSchema);

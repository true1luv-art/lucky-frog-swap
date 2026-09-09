import mongoose, { Schema, Model, Types } from "mongoose";
import type { IProcessedTransaction } from "./types.server";

export type { IProcessedTransaction } from "./types.server";

const ProcessedTransactionSchema = new Schema<IProcessedTransaction>(
  {
    txHash: { type: String, required: true, unique: true, index: true },
    wallet: { type: String, required: true, index: true },
    type: {
      type:     String,
      enum:     ["deposit", "withdrawal", "marketplace_purchase", "marketplace_sale"],
      required: true,
      default:  "deposit",
    },
    amount:             { type: Number, required: true, default: 0 },
    counterpartyWallet: { type: String },
    listingId:          { type: Types.ObjectId, ref: "Listing" },
    assetName:          { type: String },
    processedAt:        { type: Number, required: true },
  },
  { collection: "transactions_processed" },
);

// Compound index for per-player history queries sorted by time.
ProcessedTransactionSchema.index({ wallet: 1, processedAt: -1 });

export const ProcessedTransactionModel: Model<IProcessedTransaction> =
  mongoose.models.ProcessedTransaction ??
  mongoose.model<IProcessedTransaction>(
    "ProcessedTransaction",
    ProcessedTransactionSchema,
  );

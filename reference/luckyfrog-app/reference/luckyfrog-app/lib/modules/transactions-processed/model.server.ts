import mongoose, { Schema, Model } from "mongoose";
import type { IProcessedTransaction } from "./types.server";

export type { IProcessedTransaction } from "./types.server";

const ProcessedTransactionSchema = new Schema<IProcessedTransaction>(
  {
    txHash: { type: String, required: true, unique: true, index: true },
    wallet: { type: String, required: true },
    type: {
      type: String,
      enum: ["transaction", "stash"],
      required: true,
      default: "transaction",
    },
    processedAt: { type: Number, required: true },
  },
  { collection: "transactions_processed" },
);

export const ProcessedTransactionModel: Model<IProcessedTransaction> =
  mongoose.models.ProcessedTransaction ??
  mongoose.model<IProcessedTransaction>(
    "ProcessedTransaction",
    ProcessedTransactionSchema,
  );

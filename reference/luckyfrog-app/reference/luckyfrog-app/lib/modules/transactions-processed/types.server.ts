/**
 * lib/modules/transactions-processed/types.server.ts
 *
 * Pure TypeScript types for the `transactions_processed` domain.
 * No mongoose runtime code — only the Document interface lives here.
 * Consumed by model.server.ts and any external code that needs the shape
 * without importing the Mongoose model.
 */

import type { Document } from "mongoose";

export interface IProcessedTransaction extends Document {
  txHash: string;
  wallet: string;
  type: "transaction" | "stash";
  processedAt: number;
}

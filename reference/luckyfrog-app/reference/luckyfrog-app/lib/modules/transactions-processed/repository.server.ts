import { ProcessedTransactionModel } from "./model.server";
import { connectDatabase } from "@/lib/config/database";

// ---------------------------------------------------------------------------
// Idempotency guard for Solana transactions
//
// Rule: insert txHash BEFORE granting any game item.
// If a second request arrives with the same txHash, findProcessedTransaction
// returns the existing doc and the caller must abort without granting again.
// ---------------------------------------------------------------------------

/** Returns the record if this txHash has already been processed. */
export async function findProcessedTransaction(txHash: string) {
  await connectDatabase();
  return ProcessedTransactionModel.findOne({ txHash }).lean();
}

/**
 * Insert a txHash record.  The `txHash` field has a unique index, so a
 * concurrent duplicate insert will throw a MongoDB E11000 duplicate-key error.
 * Callers should catch that error and treat it as "already processed".
 *
 * `type` defaults to `transaction`; stash writes must opt into `stash`.
 */
export async function insertProcessedTransaction(
  txHash: string,
  wallet: string,
  type: "transaction" | "stash" = "transaction",
) {
  await connectDatabase();
  return ProcessedTransactionModel.create({
    txHash,
    wallet,
    type,
    processedAt: Date.now(),
  });
}

/** Check existence only (boolean shortcut). */
export async function isTransactionProcessed(txHash: string): Promise<boolean> {
  await connectDatabase();
  const count = await ProcessedTransactionModel.countDocuments({ txHash });
  return count > 0;
}

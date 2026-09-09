import { ProcessedTransactionModel } from "./model.server";
import { connectDatabase }           from "@/lib/config/database";
import type { ProcessedTransactionType } from "./types.server";
import type { Types }                from "mongoose";

// ---------------------------------------------------------------------------
// Idempotency guard
//
// Rule: insert txHash BEFORE crediting any player balance.
// If a second request arrives with the same txHash, findProcessedTransaction
// returns the existing doc and the caller must abort without crediting again.
// ---------------------------------------------------------------------------

/** Returns the record if this txHash has already been processed. */
export async function findProcessedTransaction(txHash: string) {
  await connectDatabase();
  return ProcessedTransactionModel.findOne({ txHash }).lean();
}

export interface InsertProcessedTransactionInput {
  txHash:             string;
  wallet:             string;
  type:               ProcessedTransactionType;
  amount:             number;
  counterpartyWallet?: string;
  listingId?:         Types.ObjectId;
  assetName?:         string;
}

/**
 * Insert a ledger row. The `txHash` field has a unique index — concurrent
 * duplicate inserts will throw MongoDB E11000. Callers should catch that and
 * treat it as "already processed".
 */
export async function insertProcessedTransaction(
  input: InsertProcessedTransactionInput,
): Promise<void> {
  await connectDatabase();
  await ProcessedTransactionModel.create({
    ...input,
    processedAt: Date.now(),
  });
}

/** Check existence only (boolean shortcut for idempotency guard). */
export async function isTransactionProcessed(txHash: string): Promise<boolean> {
  await connectDatabase();
  const count = await ProcessedTransactionModel.countDocuments({ txHash });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Per-player transaction history
// ---------------------------------------------------------------------------

export interface TxHistoryRow {
  txHash:             string;
  type:               ProcessedTransactionType;
  amount:             number;
  counterpartyWallet?: string;
  listingId?:         string;
  assetName?:         string;
  processedAt:        number;
}

export interface TxHistoryResult {
  transactions: TxHistoryRow[];
  nextCursor:   number | null;
}

/**
 * Returns paginated transaction history for a player, newest-first.
 * Uses keyset pagination on `processedAt` (pass the last row's `processedAt`
 * as `cursor` to get the next page).
 */
export async function getTransactionHistory(
  wallet:   string,
  limit:    number = 20,
  cursor?:  number,
  type?:    ProcessedTransactionType,
): Promise<TxHistoryResult> {
  await connectDatabase();

  const query: Record<string, unknown> = { wallet };
  if (type)   query.type        = type;
  if (cursor) query.processedAt = { $lt: cursor };

  const docs = await ProcessedTransactionModel
    .find(query)
    .sort({ processedAt: -1 })
    .limit(limit + 1)
    .lean<{
      txHash:             string;
      type:               ProcessedTransactionType;
      amount:             number;
      counterpartyWallet?: string;
      listingId?:         { toString(): string };
      assetName?:         string;
      processedAt:        number;
    }[]>();

  const hasMore = docs.length > limit;
  const rows    = (hasMore ? docs.slice(0, limit) : docs).map((d) => ({
    txHash:             d.txHash,
    type:               d.type,
    amount:             d.amount,
    counterpartyWallet: d.counterpartyWallet,
    listingId:          d.listingId?.toString(),
    assetName:          d.assetName,
    processedAt:        d.processedAt,
  }));

  return {
    transactions: rows,
    nextCursor:   hasMore ? rows[rows.length - 1].processedAt : null,
  };
}

/**
 * lib/modules/transactions-processed/types.server.ts
 *
 * Full transaction ledger — every on-chain and in-game coin-flow event that
 * belongs to a player is recorded here.
 *
 * deposit             — player sent HFARM on-chain → treasury → coins credited
 * withdrawal          — player sent HFARM on-chain from treasury → player wallet
 * marketplace_purchase — buyer paid coins for a listing
 * marketplace_sale    — seller received net coins from a sale
 */

import type { Document, Types } from "mongoose";

export type ProcessedTransactionType =
  | "deposit"
  | "withdrawal"
  | "marketplace_purchase"
  | "marketplace_sale";

/**
 * Plain-object view returned by GET /api/transactions.
 * Safe to import in client-side hooks — no Mongoose types.
 */
export interface TxHistoryRow {
  _id:                string;
  txHash:             string;
  wallet:             string;
  type:               ProcessedTransactionType;
  amount:             number;
  counterpartyWallet?: string;
  listingId?:         string;
  assetName?:         string;
  processedAt:        number;
}

export interface IProcessedTransaction extends Document {
  /**
   * Unique identifier for this ledger row.
   * On-chain rows use the actual txHash.
   * Marketplace / in-game rows use a UUID so they never collide.
   */
  txHash: string;

  /** The player wallet this row belongs to. Indexed for per-player queries. */
  wallet: string;

  type: ProcessedTransactionType;

  /**
   * Net coin delta for this player.
   * Positive = coins received; negative = coins spent.
   */
  amount: number;

  /** Seller wallet on a purchase row; buyer wallet on a sale row. */
  counterpartyWallet?: string;

  /** Ref to listings._id for marketplace rows. */
  listingId?: Types.ObjectId;

  /** Item name for marketplace rows. */
  assetName?: string;

  /** Unix ms timestamp when the transaction was finalised. */
  processedAt: number;
}

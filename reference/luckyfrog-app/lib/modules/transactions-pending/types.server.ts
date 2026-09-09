/**
 * lib/modules/transactions-pending/types.server.ts
 */

import type { Document, Types } from "mongoose";

/** Lifecycle of a queued row. */
export type InboundTxStatus = "pending" | "failed" | "dead";

/**
 * All transaction types that flow through the pending queue.
 * The frontend creates a pending row for each, the transaction-worker processes it.
 */
export type TransactionType = "deposit" | "withdrawal" | "marketplace_purchase";

export interface IInboundTransaction extends Document {
  type: TransactionType;

  /**
   * Idempotency key (unique index).
   * - deposit:              on-chain tx hash (provided by frontend after the on-chain send)
   * - withdrawal:           UUID generated at enqueue time
   * - marketplace_purchase: UUID generated at enqueue time
   */
  signature: string;

  // ── deposit fields ────────────────────────────────────────────────────────

  /** On-chain sender address. Only for deposit rows. */
  sender: string;

  /** Human-readable token amount transferred. Only for deposit rows. */
  tokenAmount: number;

  /** Raw on-chain units as string. Only for deposit rows. */
  rawAmount: string;

  memo: string | null;

  /** Chain block time (unix seconds). Only for deposit rows. */
  blockTime: number;

  // ── withdrawal fields ─────────────────────────────────────────────────────

  /** Wallet address of the player requesting withdrawal. Only for withdrawal rows. */
  walletAddress?: string;

  /** Amount of coins to withdraw. Only for withdrawal rows. */
  withdrawAmount?: number;

  // ── marketplace_purchase fields ───────────────────────────────────────────

  /** _id of the listing being purchased. Only for marketplace_purchase rows. */
  listingId?: Types.ObjectId;

  /** Wallet of the buyer. Only for marketplace_purchase rows. */
  buyerWallet?: string;

  /** Number of units the buyer wants to purchase. Only for marketplace_purchase rows. */
  quantity?: number;

  // ── lifecycle ─────────────────────────────────────────────────────────────

  status: InboundTxStatus;
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

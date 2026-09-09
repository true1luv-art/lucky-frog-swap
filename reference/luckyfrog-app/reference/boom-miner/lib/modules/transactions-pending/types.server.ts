/**
 * lib/modules/transactions-pending/types.server.ts
 *
 * Types for the durable work queue (`transactions_pending`).
 * One row per requested withdrawal OR mint, drained sequentially by the
 * sidecar worker.
 *
 * No mongoose runtime code — only interfaces live here.
 */

import type { Document } from "mongoose";

export type InboundTxStatus = "pending" | "failed" | "dead";

/** Union kept open so deposit / marketplace types can be added later. */
export type TransactionType = "withdrawal" | "mint";

export interface IInboundTransaction extends Document {
  type: TransactionType;
  /**
   * Idempotency key — unique across the queue.
   * - withdrawal: a server-generated UUID.
   * - mint: the on-chain transfer signature (txId) the player signed.
   */
  signature: string;

  /** Player's Solana address (payout recipient for withdrawal / minter for mint). */
  walletAddress: string;

  // ---- withdrawal fields --------------------------------------------------
  /** Whole coins requested. Present only when `type === "withdrawal"`. */
  withdrawAmount?: number;

  // ---- mint fields --------------------------------------------------------
  /** Number of heroes to mint. Present only when `type === "mint"`. */
  mintCount?: number;
  /** Deterministic hero numbers the player paid to mint. */
  mintedNumbers?: number[];

  // ---- lifecycle ----------------------------------------------------------
  status: InboundTxStatus;
  retryCount: number;
  lastError?: string;

  // timestamps: true → these are managed by mongoose
  createdAt: Date;
  updatedAt: Date;
}

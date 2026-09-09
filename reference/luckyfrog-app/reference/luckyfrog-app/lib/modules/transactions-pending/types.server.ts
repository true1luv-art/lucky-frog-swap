/**
 * lib/modules/transactions-pending/types.server.ts
 *
 * Pure TypeScript types for the transactions-pending module.
 * No Mongoose runtime code — safe to import from any server-side file.
 */

import type { Document } from "mongoose";

/** Lifecycle of a queued row (inbound deposit or outbound payout). */
export type InboundTxStatus = "pending" | "failed" | "dead";

/** Supported transaction purposes. Legacy kinds are intentionally rejected. */
export type TransactionType = "transaction" | "stash";

/**
 * Discriminator for the KIND of work a row represents. Absent (`undefined`) on
 * raw inbound deposit rows — those are classified later from their `memo`. Set
 * explicitly on payout rows enqueued by the settlement services.
 */
export type SettlementKind = "seller_payout" | "buyer_refund";

export interface IInboundTransaction extends Document {
  /** Supported purpose for this queued record. */
  type: TransactionType;

  /**
   * Idempotency key (unique). For inbound rows this is the real on-chain
   * transaction signature. For payout rows it is a SYNTHETIC key of the form
   * `` `${kind}:${refSignature}` `` so each source purchase enqueues at most one
   * payout of a given kind.
   */
  signature: string;

  /** Wallet that sent the $LFRG (on-chain authority, never the memo). */
  sender: string;

  /** Human-readable token amount that landed on the escrow ATA (e.g. 500.0). */
  tokenAmount: number;

  /** Raw on-chain units (tokenAmount * 10^decimals), stored as string (bigint-safe). */
  rawAmount: string;

  /**
   * Decoded SPL-Memo payload, or null when absent. ROUTING-ONLY — classified by
   * the consumer to pick a flow; never trusted for buyer/amount/dedup.
   */
  memo: string | null;

  /** Chain block time (unix seconds) — used to drain oldest-first (chain order). */
  blockTime: number;

  /** Current lifecycle state. */
  status: InboundTxStatus;

  /** Number of failed processing attempts so far. */
  retryCount: number;

  /** Last processing error message (for observability / dead-letter review). */
  lastError?: string;

  // ── Payout-row routing fields (optional; unset on raw inbound rows) ──────────

  /** What kind of work this row is. Unset on raw inbound deposits. */
  kind?: SettlementKind;

  /** Wallet that receives the escrow transfer (payout rows only). */
  recipient?: string;

  /** Source purchase signature used to build the synthetic key (payout rows). */
  refSignature?: string;

  /** $LFRG amount this job moves (payout rows). Defaults to 0. */
  totalPaid?: number;

  /** When this row was first enqueued. */
  createdAt: Date;
  updatedAt: Date;
}

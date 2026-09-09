/**
 * lib/modules/marketplace/hash.server.ts
 *
 * Short, unique listing identifier used as the on-chain purchase memo.
 *
 * When a buyer purchases a listing they sign an $LFRG transfer whose Memo
 * instruction reads `buy_item_{hash}`. The confirm endpoint requires the memo
 * to match the listing being claimed, binding the payment to a specific
 * listing and preventing pay-cheap / claim-expensive fraud.
 *
 * The hash is deliberately short (12 hex chars = 6 random bytes) so it fits
 * comfortably in a memo while remaining collision-resistant for the number of
 * listings the marketplace will ever hold.
 */

import { randomBytes } from "crypto";

/** Prefix used for every marketplace purchase memo. */
export const MARKETPLACE_MEMO_PREFIX = "buy_item_";

/**
 * Generates a compact, unique listing hash (12 lowercase hex characters).
 */
export function generateListingHash(): string {
  return randomBytes(6).toString("hex");
}

/**
 * Builds the canonical on-chain memo string for a listing hash.
 * e.g. `buy_item_9f3a1c7b2e08`
 */
export function buildPurchaseMemo(hash: string): string {
  return `${MARKETPLACE_MEMO_PREFIX}${hash}`;
}

import { PublicKey, TransactionInstruction } from "@solana/web3.js";

/** SPL Memo program v2 — shared by the marketplace payment builders. */
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

/** Marketplace identifier embedded in every marketplace memo. */
export const MARKETPLACE_ID = "luckyfrog.market";

/** Marketplace actions use `tm_purchase-<hash>`. */
export const MARKET_ACTION_PREFIX = "tm_purchase-";

export interface MarketMemo {
  action: string;
  marketplace: string;
  item_number: string;
  type: string;
  seller: string;
  amount: number;
}

export type ParsedMemo =
  | { kind: "transaction"; hash: string; memo: MarketMemo }
  | null;

/** Wraps a JSON-serializable payload in an SPL-Memo instruction. */
export function buildMemoInstruction(payload: object): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(JSON.stringify(payload), "utf8"),
  });
}

/** Builds the marketplace memo action string for a listing hash. */
export function buildMarketAction(hash: string): string {
  return `${MARKET_ACTION_PREFIX}${hash}`;
}

/** Builds the full marketplace memo payload. */
export function buildMarketMemo(params: {
  hash: string;
  assetId: string;
  assetType: string;
  seller: string;
  amount: number;
}): MarketMemo {
  return {
    action: buildMarketAction(params.hash),
    marketplace: MARKETPLACE_ID,
    item_number: params.assetId,
    type: params.assetType,
    seller: params.seller,
    amount: params.amount,
  };
}

/**
 * Parses a marketplace memo. Unsupported and legacy action kinds return null.
 * Memo data is routing-only; settlement derives identity and payment data from
 * the on-chain transfer.
 */
export function parseActionMemo(raw: string | null | undefined): ParsedMemo {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object") return null;
  const action = (value as { action?: unknown }).action;
  if (typeof action !== "string" || !action.startsWith(MARKET_ACTION_PREFIX)) {
    return null;
  }

  const hash = action.slice(MARKET_ACTION_PREFIX.length);
  if (!hash) return null;

  return { kind: "transaction", hash, memo: value as MarketMemo };
}

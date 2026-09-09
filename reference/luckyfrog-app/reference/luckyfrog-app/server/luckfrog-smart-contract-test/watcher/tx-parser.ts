/**
 * server/luckfrog-smart-contract-test/watcher/tx-parser.ts
 *
 * Turns a raw transaction signature into normalized inbound $LFRG transfers by
 * querying the Helius Enhanced Transactions API, then filtering for transfers
 * that landed IN the market wallet (from someone other than the market wallet).
 *
 * The parser is read-only and side-effect free — it never sends tokens, never
 * touches the DB, and never dedups. Callers own dedup + reaction.
 */
import bs58 from "bs58";
import { HELIUS_ENHANCED_URL, LFRG_MINT, MARKET_TEST_ADDRESS } from "../config";
import { MEMO_PROGRAM_ID } from "@/lib/solana/memo";
import { log } from "../lib/logger";

/** Base58 string form of the SPL-Memo program id, for matching instructions. */
const MEMO_PROGRAM = MEMO_PROGRAM_ID.toBase58();

interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  mint: string;
  tokenAmount: number;
}

interface HeliusInstruction {
  programId: string;
  /** Base58-encoded instruction data (memo bytes for the memo program). */
  data?: string;
  innerInstructions?: HeliusInstruction[];
}

interface HeliusParsedTx {
  signature: string;
  /** Chain block time in unix seconds (Helius Enhanced field), when present. */
  timestamp?: number;
  tokenTransfers?: HeliusTokenTransfer[];
  instructions?: HeliusInstruction[];
}

/** A normalized $LFRG payment into the market wallet. */
export interface InboundTransfer {
  /** On-chain signature that carried this transfer. */
  signature: string;
  /** Wallet that sent the $LFRG. */
  sender: string;
  /** Human-readable token amount (e.g. 500.0). */
  tokenAmount: number;
  /** Raw on-chain units (tokenAmount * 10^decimals). */
  rawAmount: bigint;
  /**
   * Decoded SPL-Memo payload attached to the transaction, or null when absent.
   * ROUTING-ONLY — the sender/amount are always taken from the on-chain
   * transfer, never trusted from the memo. Consumed by the memo router.
   */
  memo: string | null;
  /**
   * Chain block time (unix seconds), or undefined when the parser could not
   * determine it. Used to drain the durable inbound queue in chain order.
   */
  blockTime?: number;
}

/** Fetches the parsed representation of a single transaction, or null on error. */
export async function fetchParsedTransaction(
  signature: string,
): Promise<HeliusParsedTx | null> {
  try {
    const res = await fetch(HELIUS_ENHANCED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: [signature] }),
    });

    if (!res.ok) {
      log.error(`Helius API error ${res.status} for sig ${signature}`);
      return null;
    }

    const data = (await res.json()) as HeliusParsedTx[];
    return data[0] ?? null;
  } catch (err) {
    log.error(`Failed to fetch parsed tx ${signature}:`, err);
    return null;
  }
}

/** Decodes base58 memo-instruction data to a UTF-8 string, or null on failure. */
function decodeMemoData(dataB58: string): string | null {
  try {
    const bytes = bs58.decode(dataB58);
    const text = Buffer.from(bytes).toString("utf8");
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Extracts the first SPL-Memo payload from a parsed tx, scanning both top-level
 * and inner instructions. Returns null when the tx carries no memo.
 */
export function extractMemo(parsed: HeliusParsedTx): string | null {
  const scan = (instrs: HeliusInstruction[] | undefined): string | null => {
    for (const ix of instrs ?? []) {
      if (ix.programId === MEMO_PROGRAM && ix.data) {
        const decoded = decodeMemoData(ix.data);
        if (decoded) return decoded;
      }
      const inner = scan(ix.innerInstructions);
      if (inner) return inner;
    }
    return null;
  };
  return scan(parsed.instructions);
}

/**
 * Extracts inbound $LFRG transfers into the market wallet from a parsed tx.
 * Returns one entry per qualifying transfer (a tx may contain several senders).
 * The transaction's memo (if any) is attached to every extracted transfer.
 */
export function extractInboundTransfers(
  parsed: HeliusParsedTx,
  rawMultiplier: bigint,
): InboundTransfer[] {
  const memo = extractMemo(parsed);
  const transfers = (parsed.tokenTransfers ?? []).filter(
    (t) =>
      t.mint === LFRG_MINT &&
      t.toUserAccount === MARKET_TEST_ADDRESS &&
      t.fromUserAccount !== MARKET_TEST_ADDRESS &&
      t.tokenAmount > 0,
  );

  const result: InboundTransfer[] = [];

  for (const t of transfers) {
    const rawAmount = BigInt(Math.round(t.tokenAmount * Number(rawMultiplier)));
    if (rawAmount === 0n) {
      log.warn(
        `Zero raw amount for transfer from ${t.fromUserAccount} in ${parsed.signature} — skipping.`,
      );
      continue;
    }
    result.push({
      signature: parsed.signature,
      sender: t.fromUserAccount,
      tokenAmount: t.tokenAmount,
      rawAmount,
      memo,
      blockTime: parsed.timestamp,
    });
  }

  return result;
}

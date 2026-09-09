/**
 * lib/solana/parse-purchase.ts
 *
 * Pure helpers for reading a parsed Solana transaction — shared by the payment
 * verify helpers and the streaming settlement monitor. No network or config
 * dependencies so it can be imported anywhere.
 *
 *   extractMemoStrings — every SPL-Memo payload present in a transaction.
 *   getSignerWallet    — the fee payer (first signer) = the buyer in our flows.
 *   parsePurchaseTx    — memo + buyer for a purchase transaction.
 */

import type {
  ParsedTransactionWithMeta,
  ParsedInstruction,
  PartiallyDecodedInstruction,
} from "@solana/web3.js";
import { MEMO_PROGRAM_ID, parseActionMemo, type ParsedMemo } from "./memo";

type AnyIx = ParsedInstruction | PartiallyDecodedInstruction;

/** Flattens top-level + inner instructions of a parsed transaction. */
export function flattenInstructions(parsed: ParsedTransactionWithMeta): AnyIx[] {
  const top = parsed.transaction.message.instructions as AnyIx[];
  const inner = (parsed.meta?.innerInstructions ?? []).flatMap(
    (g) => g.instructions as AnyIx[],
  );
  return [...top, ...inner];
}

/** Extracts every memo string present in a parsed transaction. */
export function extractMemoStrings(parsed: ParsedTransactionWithMeta): string[] {
  const memos: string[] = [];
  for (const ix of flattenInstructions(parsed)) {
    // Parsed memo instructions surface as program "spl-memo" with the memo as
    // either `parsed` (a plain string) or nested under `parsed.info`.
    const program = (ix as ParsedInstruction).program;
    if (program === "spl-memo") {
      const parsedField = (ix as unknown as { parsed?: unknown }).parsed;
      if (typeof parsedField === "string") memos.push(parsedField);
      else if (parsedField && typeof parsedField === "object" && "info" in parsedField) {
        const info = (parsedField as { info?: unknown }).info;
        if (typeof info === "string") memos.push(info);
      }
      continue;
    }
    // Fallback: undecoded instruction addressed to the Memo program.
    const programId = (ix as PartiallyDecodedInstruction).programId;
    if (programId && programId.equals(MEMO_PROGRAM_ID)) {
      const data = (ix as PartiallyDecodedInstruction).data;
      if (typeof data === "string") {
        try {
          memos.push(Buffer.from(data, "base64").toString("utf8"));
        } catch {
          /* ignore undecodable memo data */
        }
      }
    }
  }
  return memos;
}

/**
 * Returns the fee payer wallet (first signer) of a parsed transaction. In both
 * the egg and marketplace flows the buyer signs and pays fees, so this is the
 * authoritative buyer identity — never trust the buyer field from a memo.
 */
export function getSignerWallet(parsed: ParsedTransactionWithMeta): string | null {
  const keys = parsed.transaction.message.accountKeys;
  const signer = keys.find((k) => k.signer);
  return signer ? signer.pubkey.toBase58() : keys[0]?.pubkey.toBase58() ?? null;
}

/**
 * Parses a purchase transaction into its routing memo + buyer identity.
 * Returns the first recognised action memo (marketplace or egg) and the signer.
 */
export function parsePurchaseTx(parsed: ParsedTransactionWithMeta): {
  memo: ParsedMemo;
  buyer: string | null;
} {
  let memo: ParsedMemo = null;
  for (const raw of extractMemoStrings(parsed)) {
    const p = parseActionMemo(raw);
    if (p) {
      memo = p;
      break;
    }
  }
  return { memo, buyer: getSignerWallet(parsed) };
}

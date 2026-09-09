import { parseActionMemo, type ParsedMemo } from "@/lib/solana/memo";

/** The settlement flow an inbound transfer maps to. */
export type RouteKind = "transaction" | "unknown";

/** Result of classifying a transfer memo. */
export interface RouteDecision {
  kind: RouteKind;
  parsed: ParsedMemo;
}

/**
 * Routes supported marketplace transaction memos and rejects absent,
 * malformed, and retired legacy action kinds.
 */
export function classifyMemo(raw: string | null | undefined): RouteDecision {
  const parsed = parseActionMemo(raw);
  if (!parsed) return { kind: "unknown", parsed: null };
  return { kind: "transaction", parsed };
}

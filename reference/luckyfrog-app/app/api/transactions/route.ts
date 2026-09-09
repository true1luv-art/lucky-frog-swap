/**
 * GET /api/transactions
 *
 * Returns paginated transaction history for the authenticated player.
 * Replaces WebSocket push notifications — clients poll this endpoint.
 *
 * Query params:
 *   limit  — number of rows per page (default 25, max 25)
 *   cursor — processedAt (unix ms) of the last row on the previous page
 *            (omit for the first page)
 *   type   — filter by transaction type:
 *            "deposit" | "withdrawal" | "marketplace_purchase" | "marketplace_sale"
 *
 * Response:
 *   { transactions: TxHistoryRow[], nextCursor: number | null }
 */

import { NextResponse }            from "next/server";
import { getWallet }               from "@/lib/api/get-wallet";
import { getTransactionHistory }   from "@/lib/modules/transactions-processed/repository.server";
import type { ProcessedTransactionType } from "@/lib/modules/transactions-processed/types.server";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT     = 25;

const VALID_TYPES = new Set<ProcessedTransactionType>([
  "deposit",
  "withdrawal",
  "marketplace_purchase",
  "marketplace_sale",
]);

export async function GET(req: Request): Promise<NextResponse> {
  const wallet = await getWallet(req);
  if (!wallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url    = new URL(req.url);
  const params = url.searchParams;

  const limit = Math.min(
    parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const cursorRaw = params.get("cursor");
  const cursor    = cursorRaw ? parseInt(cursorRaw, 10) || undefined : undefined;

  const typeParam = params.get("type") ?? undefined;
  const type      =
    typeParam && VALID_TYPES.has(typeParam as ProcessedTransactionType)
      ? (typeParam as ProcessedTransactionType)
      : undefined;

  const result = await getTransactionHistory(wallet, limit, cursor, type);

  return NextResponse.json(result);
}

"use client";

/**
 * hooks/useTransactions.ts
 *
 * Polls GET /api/transactions every 5 s while the player is logged in.
 * On each response, diffs the returned IDs against the previous snapshot —
 * if any new rows appear, calls onNewTransactions with just the new ones.
 *
 * This replaces the WebSocket layer for all three event types:
 *   deposit, withdrawal, marketplace_purchase, marketplace_sale
 */

import { useEffect, useRef, useCallback } from "react";
import type { TxHistoryRow } from "@/lib/modules/transactions-processed/types.server";

export type { TxHistoryRow };

export interface UseTransactionsOptions {
  /** Wallet address — pass undefined to keep the poll inactive. */
  wallet: string | undefined;
  /** Called only when rows appear that were not in the previous snapshot. */
  onNewTransactions?: (rows: TxHistoryRow[]) => void;
}

const POLL_INTERVAL = 5_000;

export function useTransactions({ wallet, onNewTransactions }: UseTransactionsOptions): void {
  const seenIds          = useRef<Set<string>>(new Set());
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const onNewRef         = useRef(onNewTransactions);
  const mountedRef       = useRef(true);

  // Keep callback ref current without restarting the poll.
  useEffect(() => { onNewRef.current = onNewTransactions; }, [onNewTransactions]);

  const poll = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch("/api/transactions", { credentials: "include" });
      if (!res.ok || !mountedRef.current) return;

      const data = await res.json() as { transactions: TxHistoryRow[] };
      const rows = data.transactions ?? [];

      const newRows = rows.filter((r) => !seenIds.current.has(r._id));
      if (newRows.length > 0) {
        newRows.forEach((r) => seenIds.current.add(r._id));
        onNewRef.current?.(newRows);
      }

      // Seed on first call (no notification for pre-existing rows).
      if (seenIds.current.size === 0) {
        rows.forEach((r) => seenIds.current.add(r._id));
      }
    } catch {
      // Network error — silent, will retry next tick.
    }
  }, [wallet]);

  useEffect(() => {
    mountedRef.current = true;

    if (!wallet) return;

    // Seed immediately on mount so pre-existing rows are not announced.
    fetch("/api/transactions", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { transactions: TxHistoryRow[] } | null) => {
        if (!mountedRef.current || !data) return;
        data.transactions?.forEach((r) => seenIds.current.add(r._id));
      })
      .catch(() => undefined);

    timerRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      seenIds.current.clear();
    };
  }, [wallet, poll]);
}

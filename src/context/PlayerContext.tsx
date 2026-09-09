

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useTransactions } from "@/hooks/useTransactions";
import type { TxHistoryRow } from "@/hooks/useTransactions";
import { useFarmToast } from "@/context/ToastContext";

// ---------------------------------------------------------------------------
// PlayerSnapshot
// ---------------------------------------------------------------------------
export interface PlayerSnapshot {
  username: string;
  wallet:   string;
  sol:      number;
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
interface PlayerContextValue {
  player:        PlayerSnapshot | undefined;
  refreshPlayer: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// ---------------------------------------------------------------------------
// Toast labels per transaction type
// ---------------------------------------------------------------------------
function toastForRow(row: TxHistoryRow): string | null {
  switch (row.type) {
    case "marketplace_purchase":
      return `Purchase settled: ${row.assetName ?? "item"} bought`;
    case "marketplace_sale":
      return `Sale settled: ${row.assetName ?? "item"} sold`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function PlayerProvider({
  children,
  initialPlayer,
}: {
  children:       ReactNode;
  initialPlayer?: PlayerSnapshot;
}) {
  const [player, setPlayer] = useState<PlayerSnapshot | undefined>(initialPlayer);
  const { addToast } = useFarmToast();

  // ── Transaction poll — fires indefinitely while player is logged in ────────
  const handleNewTransactions = useCallback((rows: TxHistoryRow[]) => {
    for (const row of rows) {
      // Fire a toast notification for each new transaction.
      const label = toastForRow(row);
      if (label) addToast(label);
    }
  }, [addToast]);

  useTransactions({
    wallet:              player?.wallet,
    onNewTransactions:   handleNewTransactions,
  });

  // ── REST refresh (manual pull / force-sync) ───────────────────────────────
  const refreshPlayer = useCallback(async () => {
    // Local-only build: the player snapshot lives in the browser, so there is
    // nothing to pull from a server.
    setPlayer((prev) => (prev ? { ...prev } : prev));
  }, []);

  return (
    <PlayerContext.Provider value={{ player, refreshPlayer }}>
      {children}
    </PlayerContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

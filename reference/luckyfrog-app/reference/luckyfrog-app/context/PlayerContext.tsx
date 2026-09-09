"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
// ---------------------------------------------------------------------------
// PlayerSnapshot — defined here (source of truth) so that the import chain
// layout.tsx → PlayerContext → GameShell → BottomNav/GameHeader (client
// components) is broken. Turbopack silently drops the (phaser) route when
// that chain is present. GameShell re-exports this type for compatibility.
// ---------------------------------------------------------------------------
export interface PlayerSnapshot {
  username: string;
  wallet:   string;
  lfrg: number;
  sol: number;
  // §C4 — player level / exp removed ("No Player Level", §5.13)
  // §Phase 3 — mining stat removed (frogs/eggs/mining removed from game)
  stats: {
    luck:   number;
    crit:   number;
    dodge:  number;
  };
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
interface PlayerContextValue {
  player: PlayerSnapshot | undefined;
  refreshPlayer: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function PlayerProvider({
  children,
  initialPlayer,
}: {
  children: ReactNode;
  initialPlayer?: PlayerSnapshot;
}) {
  const [player, setPlayer] = useState<PlayerSnapshot | undefined>(initialPlayer);

  const refreshPlayer = useCallback(async () => {
    const wallet = player?.wallet;
    if (!wallet) return;

    try {
      const res = await fetch(`/api/player/${wallet}`);
      if (!res.ok) return;
      const doc = await res.json();

      const level  = doc.level ?? 1;
      const exp    = doc.xp   ?? 0;
      const expMax = level * 1000;

      setPlayer((prev) =>
        prev
          ? {
              ...prev,
              level,
              exp,
              expMax,
              lfrg: doc.gameBalance ?? doc.lfrg ?? prev.lfrg,
            }
          : prev,
      );
    } catch {
      // silently ignore — header just stays at its last-known state
    }
  }, [player?.wallet]);

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
  if (!ctx) {
    throw new Error("usePlayer must be used inside <PlayerProvider>");
  }
  return ctx;
}

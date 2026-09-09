"use client";

import Link from "next/link";
import type { LeaderboardEntry } from "./LeaderboardClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 1) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(decimals) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(decimals) + "K";
  return n.toFixed(decimals === 0 ? 0 : 1);
}

function abbrev(addr: string) {
  if (addr.length <= 10) return addr;
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

const RANK_STYLES: Record<number, string> = {
  1: "text-gold text-glow-gold font-pixel",
  2: "text-foreground/70 font-pixel",
  3: "text-rose font-pixel",
};

const RARITY_DOT: Record<string, string> = {
  legendary: "bg-gold",
  epic:      "bg-rose",
  rare:      "bg-accent",
  uncommon:  "bg-neon",
  common:    "bg-muted-foreground",
};

// ---------------------------------------------------------------------------
// Column header helper
// ---------------------------------------------------------------------------

function Th({ children, right = false, hide = "" }: { children: React.ReactNode; right?: boolean; hide?: string }) {
  return (
    <th
      className={`border-b-4 border-border bg-swamp px-3 py-3 font-pixel text-[8px] uppercase tracking-widest text-muted-foreground whitespace-nowrap ${right ? "text-right" : "text-left"} ${hide}`}
    >
      {children}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  myWallet: string | null;
}

export function LeaderboardTable({ entries, myWallet }: LeaderboardTableProps) {
  return (
    <div className="fantasy-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <Th>Rank</Th>
              <Th>Player</Th>
              <Th right hide="hidden md:table-cell">Level</Th>
              <Th right hide="hidden lg:table-cell">Mining</Th>
              <Th right hide="hidden lg:table-cell">Luck</Th>
              <Th right>Score</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const isMe = entry.wallet === myWallet;
              const score = entry.level * 100 + entry.stats.mining + entry.stats.luck;
              const rankStyle = RANK_STYLES[entry.rankByPower] ?? "text-muted-foreground font-pixel";
              const displayName = entry.username ?? abbrev(entry.wallet);

              return (
                <tr
                  key={entry.wallet}
                  className={`border-b-2 border-border transition-colors hover:bg-swamp/60 ${
                    isMe ? "bg-neon/5 border-l-4 border-l-neon" : ""
                  }`}
                >
                  {/* Rank */}
                  <td className="px-3 py-3 w-12">
                    <span className={`text-[10px] tabular-nums ${rankStyle}`}>
                      #{entry.rankByPower}
                    </span>
                  </td>

                  {/* Player */}
                  <td className="px-3 py-3 min-w-[140px]">
                    <div className="flex flex-col gap-0.5">
                      <Link
                        href={`/profile/${entry.wallet}`}
                        title={entry.wallet}
                        className="font-pixel text-[9px] text-foreground hover:text-neon transition truncate max-w-[160px]"
                      >
                        {displayName}
                        {isMe && (
                          <span className="ml-1.5 text-neon">(you)</span>
                        )}
                      </Link>
                      {/* Top frog preview */}
                      {entry.topFrogs.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span
                            className={`inline-block size-1.5 rounded-full ${RARITY_DOT[entry.topFrogs[0].rarity] ?? "bg-muted-foreground"}`}
                          />
                          <span className="font-body text-xs text-muted-foreground truncate max-w-[130px]">
                            {entry.topFrogs[0].name}
                            {entry.frogCount > 1 && (
                              <span className="ml-1 text-muted-foreground/50">+{entry.frogCount - 1}</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Level */}
                  <td className="px-3 py-3 text-right hidden md:table-cell">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-gold text-[10px]">&#9733;</span>
                      <span className="font-pixel text-[10px] text-foreground tabular-nums">{entry.level}</span>
                    </div>
                  </td>

                  {/* Mining */}
                  <td className="px-3 py-3 text-right hidden lg:table-cell">
                    <span className="font-body text-sm text-foreground tabular-nums">
                      {entry.stats.mining.toFixed(3)}
                    </span>
                  </td>

                  {/* Luck */}
                  <td className="px-3 py-3 text-right hidden lg:table-cell">
                    <span className="font-body text-sm text-foreground tabular-nums">
                      {entry.stats.luck.toFixed(1)}%
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-3 py-3 text-right">
                    <span className="font-pixel text-[10px] text-neon tabular-nums">
                      {fmt(score)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

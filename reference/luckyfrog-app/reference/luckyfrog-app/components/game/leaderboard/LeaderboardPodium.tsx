"use client";

/**
 * phaser/screens/leaderboard/LeaderboardPodium.tsx
 *
 * Podium header for the Hall of Fame (Phase D of
 * docs/modal-redesign-plan.md §3): top 3 players rendered as large
 * InnerPanel cards — 2nd · 1st (raised) · 3rd — above the ranked rows.
 */

import Link from "next/link";
import { InnerPanel } from "@/components/ui/Panel";
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

const RANK_META: Record<number, { label: string; text: string; ring: string }> = {
  1: { label: "1st", text: "text-gold",          ring: "border-gold/70" },
  2: { label: "2nd", text: "text-foreground/70", ring: "border-white/30" },
  3: { label: "3rd", text: "text-rose",          ring: "border-rose/50" },
};

// Extra bottom padding creates the stepped podium silhouette
const RANK_HEIGHT: Record<number, string> = {
  1: "pb-6 sm:pb-8",
  2: "pb-3 sm:pb-4",
  3: "pb-1 sm:pb-2",
};

// ---------------------------------------------------------------------------
// Podium card
// ---------------------------------------------------------------------------

function PodiumCard({ entry, myWallet }: { entry: LeaderboardEntry; myWallet: string | null }) {
  const meta  = RANK_META[entry.rankByPower] ?? RANK_META[3];
  const isMe  = entry.wallet === myWallet;
  const score = entry.level * 100 + entry.stats.mining + entry.stats.luck;
  const displayName = entry.username ?? abbrev(entry.wallet);

  return (
    <InnerPanel
      className={`flex flex-col items-center gap-1 px-1.5 pt-2 text-center ${RANK_HEIGHT[entry.rankByPower] ?? "pb-1"}`}
    >
      {/* Rank medallion */}
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-full bg-black/40 border-2 ${meta.ring} font-pixel text-[10px] font-bold ${meta.text}`}
        aria-hidden="true"
      >
        {entry.rankByPower}
      </span>
      <span className={`font-pixel text-[8px] uppercase ${meta.text}`}>{meta.label}</span>

      {/* Player name */}
      <Link
        href={`/profile/${entry.wallet}`}
        title={entry.wallet}
        className="font-pixel text-[9px] text-foreground hover:text-neon transition truncate max-w-full leading-tight"
      >
        {displayName}
      </Link>
      {isMe && <span className="font-pixel text-[7px] text-neon leading-none">(you)</span>}

      {/* Level + score */}
      <div className="flex items-center gap-1">
        <span className="text-gold text-[10px]" aria-hidden="true">&#9733;</span>
        <span className="font-pixel text-[9px] text-foreground tabular-nums">{entry.level}</span>
      </div>
      <span className="font-pixel text-[9px] text-neon tabular-nums">{fmt(score)}</span>

      {/* Top frog */}
      {entry.topFrogs.length > 0 && (
        <span className="font-body text-[11px] text-muted-foreground truncate max-w-full leading-tight">
          {entry.topFrogs[0].name}
        </span>
      )}
    </InnerPanel>
  );
}

// ---------------------------------------------------------------------------
// Podium — 2nd · 1st · 3rd, first place raised
// ---------------------------------------------------------------------------

interface LeaderboardPodiumProps {
  entries:  LeaderboardEntry[]; // top 3 (may be fewer)
  myWallet: string | null;
}

export function LeaderboardPodium({ entries, myWallet }: LeaderboardPodiumProps) {
  if (entries.length === 0) return null;

  const first  = entries.find((e) => e.rankByPower === 1) ?? entries[0];
  const second = entries.find((e) => e.rankByPower === 2);
  const third  = entries.find((e) => e.rankByPower === 3);

  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      <div className="min-w-0">{second && <PodiumCard entry={second} myWallet={myWallet} />}</div>
      <div className="min-w-0">{first  && <PodiumCard entry={first}  myWallet={myWallet} />}</div>
      <div className="min-w-0">{third  && <PodiumCard entry={third}  myWallet={myWallet} />}</div>
    </div>
  );
}

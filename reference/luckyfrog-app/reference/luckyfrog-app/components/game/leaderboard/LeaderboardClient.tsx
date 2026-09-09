"use client";

import useSWR from "swr";
import { LeaderboardTable } from "./LeaderboardTable";
import { LeaderboardPodium } from "./LeaderboardPodium";
import { MyRankBanner } from "./MyRankBanner";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  wallet: string;
  username: string | null;
  rankByPower: number;
  collectionPower: number;
  totalMined: number;
  stash: number;
  frogCount: number;
  level: number;
  xp: number;
  stats: {
    mining: number;
    luck: number;
    crit: number;
    dodge: number;
    damage: number;
    defense: number;
  };
  topFrogs: { name: string; level: number; rarity: string; mining: number; luck: number }[];
  rewardsTier: "gold" | "silver" | "bronze" | "none";
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
  total: number;
  nextRewardAt: number;
  updatedAt: number;
}



// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type LeaderboardTab = "miners";

interface LeaderboardClientProps {
  wallet: string | null;
  /** Controlled tab — when provided, the internal tab bar is hidden
   *  (the parent renders its own switcher, e.g. a NavRail). */
  activeTab?: LeaderboardTab;
  onTabChange?: (tab: LeaderboardTab) => void;
}

type Tab = LeaderboardTab;

export function LeaderboardClient({ wallet, activeTab, onTabChange }: LeaderboardClientProps) {
  const tab = activeTab ?? "miners";

  const url = wallet
    ? `/api/leaderboard?limit=200&wallet=${encodeURIComponent(wallet)}`
    : `/api/leaderboard?limit=200`;

  const { data, error, isLoading } = useSWR<LeaderboardResponse>(url, fetcher, {
    refreshInterval: 30_000,
  });

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {/* Reward banner skeleton */}
        <div className="h-12 animate-pulse bg-muted rounded-sm" />
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse bg-muted rounded-sm"
            style={{ animationDelay: `${i * 0.03}s` }}
          />
        ))}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------
  if (error || !data) {
    return (
      <div className="fantasy-card p-8 text-center flex flex-col gap-3">
        <p className="font-pixel text-[10px] text-rose">Failed to load leaderboard</p>
        <p className="font-body text-base text-muted-foreground">
          Could not reach the server. Please try again shortly.
        </p>
      </div>
    );
  }

  // Empty state — no players yet
  if (data.entries.length === 0) {
    return (
      <div className="fantasy-card p-8 text-center flex flex-col gap-3">
        <p className="font-pixel text-[10px] text-neon">No players yet</p>
        <p className="font-body text-base text-muted-foreground">
          Be the first to stake a frog and claim your spot on the leaderboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* My rank banner */}
      {wallet && data.myEntry && <MyRankBanner entry={data.myEntry} />}

      {/* Not on the board yet */}
      {wallet && !data.myEntry && (
        <div className="fantasy-card p-4 flex items-center gap-3">
          <span className="font-pixel text-[9px] text-muted-foreground uppercase">Your rank</span>
          <span className="font-body text-base text-muted-foreground">
            Mine and claim $LFRG to appear on the leaderboard.
          </span>
        </div>
      )}

      {/* Podium — top 3 as large InnerPanel cards */}
      <LeaderboardPodium entries={data.entries.slice(0, 3)} myWallet={wallet} />

      {/* Ranked rows below the podium */}
      {data.entries.length > 3 && (
        <LeaderboardTable entries={data.entries.slice(3)} myWallet={wallet} />
      )}

      {/* Footer */}
      <p className="font-body text-sm text-muted-foreground text-center">
        {data.total.toLocaleString()} players &middot; live rankings
      </p>
    </div>
  );
}

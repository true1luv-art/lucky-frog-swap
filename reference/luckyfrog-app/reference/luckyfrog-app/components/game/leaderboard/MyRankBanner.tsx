"use client";

import type { LeaderboardEntry } from "./LeaderboardClient";

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(1);
}

interface MyRankBannerProps {
  entry: LeaderboardEntry;
}

export function MyRankBanner({ entry }: MyRankBannerProps) {
  const score = entry.level * 100 + entry.stats.mining + entry.stats.luck;

  const stats = [
    { label: "Rank",   value: `#${entry.rankByPower}`,     cls: "text-neon text-glow font-pixel" },
    { label: "Score",  value: fmt(score),                  cls: "text-foreground" },
    { label: "Level",  value: `★ ${entry.level}`,          cls: "text-gold" },
    { label: "Mining", value: entry.stats.mining.toFixed(1), cls: "text-foreground" },
    { label: "Luck",   value: `${entry.stats.luck.toFixed(1)}%`, cls: "text-foreground" },
  ];

  return (
    <div className="fantasy-card border-neon bg-neon/5 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
      {stats.map(({ label, value, cls }, i) => (
        <div key={label} className="flex items-center gap-3">
          {i > 0 && <div className="hidden sm:block w-px h-8 bg-border" />}
          <div className="flex flex-col gap-0.5">
            <span className="font-pixel text-[8px] uppercase text-muted-foreground">{label}</span>
            <span className={`font-body text-base ${cls}`}>{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

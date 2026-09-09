"use client";

import { InnerPanel } from "@/components/ui/Panel";
import { SectionLabel } from "@/components/ui/modal";
import type { ProfileData } from "./ProfileClient";

function fmtLfrg(n: number): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(2);
}

interface ProfileStatsProps {
  data: ProfileData;
}

// Reusable row inside an InnerPanel section — label left, value right
function StatRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-black/20 last:border-b-0">
      <span className="font-pixel text-[8px] text-white/60 uppercase">{label}</span>
      <span className={`font-pixel text-[9px] tabular-nums text-shadow ${accent ? "text-neon" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

// Stat row with a small pixel icon on the left
function StatIconRow({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <InnerPanel className="flex items-center gap-2 p-1.5">
      <img
        src={icon}
        alt=""
        className="w-5 h-5 shrink-0"
        style={{ imageRendering: "pixelated" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <span className="flex-1 font-pixel text-[8px] text-white/70 uppercase">{label}</span>
      <span className={`font-pixel text-[9px] tabular-nums text-shadow ${highlight ? "text-neon" : "text-white"}`}>
        {value}
      </span>
    </InnerPanel>
  );
}

export function ProfileStats({ data }: ProfileStatsProps) {
  const col = data.collection;
  const pct = col ? Math.round((col.uniqueTypesOwned / col.totalUniqueTypes) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">

      {/* ── Combat / power stats ── */}
      <SectionLabel icon="/assets/icons/quest.png">Stats</SectionLabel>
      <div className="flex flex-col gap-1.5">
        <StatIconRow label="Luck"    value={`${data.stats.luck.toFixed(1)}%`} icon="/assets/icons/luckyfrog_token.png" highlight />
        <StatIconRow label="Crit"    value={`${data.stats.crit.toFixed(1)}%`} icon="/assets/icons/lightning.png"                 />
        <StatIconRow label="Dodge"   value={`${data.stats.dodge.toFixed(1)}%`}icon="/assets/icons/confirm.png"                   />
        <div className="grid grid-cols-2 gap-1.5">
          <StatIconRow label="Damage"  value={data.stats.damage.toFixed(1)}  icon="/assets/skills/prospector.png" />
          <StatIconRow label="Defense" value={data.stats.defense.toFixed(1)} icon="/assets/icons/confirm.png"     />
        </div>
      </div>

      <SectionLabel icon="/assets/icons/luckyfrog_token.png">Game Balance</SectionLabel>
      <InnerPanel className="flex flex-col px-2 py-1">
        <StatRow label="LFRG" value={`${fmtLfrg(data.gameBalance)} LFRG`} accent />
        <StatRow label="Luck Stat" value={`${data.stats.luck.toFixed(1)}%`} />
        <StatRow label="Crit Bonus" value={`${data.stats.crit.toFixed(1)}%`} />
      </InnerPanel>

      {/* ── Collection progress ── */}
      {col && (
        <>
          <SectionLabel icon="/assets/icons/plant.png">Collection</SectionLabel>
          <InnerPanel className="flex flex-col gap-2 px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-pixel text-[8px] text-white text-shadow">
                {col.uniqueTypesOwned}
                <span className="text-white/50"> / {col.totalUniqueTypes} unique types</span>
              </span>
              <div className="flex items-center gap-1.5">
                {col.completed && (
                  <span className="font-pixel text-[7px] uppercase border border-gold text-gold px-1.5 py-0.5 leading-none">
                    Collector
                  </span>
                )}
                <span className="font-pixel text-[8px] text-white/60">{pct}%</span>
              </div>
            </div>

            {/* progress bar */}
            <div className="h-2.5 w-full bg-black/40 border border-black/30 overflow-hidden">
              <div
                className={`h-full transition-all ${col.completed ? "bg-gold" : "bg-neon"}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {col.completed && col.completedAt ? (
              <p className="font-pixel text-[8px] text-white/60">
                Completed{" "}
                <span className="text-white text-shadow">
                  {new Date(col.completedAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </span>
              </p>
            ) : (
              <p className="font-pixel text-[8px] text-white/60 leading-relaxed">
                {col.totalUniqueTypes - col.uniqueTypesOwned} type
                {col.totalUniqueTypes - col.uniqueTypesOwned !== 1 ? "s" : ""} remaining to earn the Collector badge.
              </p>
            )}
          </InnerPanel>
        </>
      )}
    </div>
  );
}

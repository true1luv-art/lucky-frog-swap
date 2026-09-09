

import useSWR from "swr";
import Decimal from "decimal.js-light";
import { InnerPanel } from "@/components/ui/Panel";
import { SectionLabel } from "@/components/ui/modal";
import { Button } from "@/components/ui/Button";
import type { ProfileData } from "./ProfileClient";
import { getSkillLevel, totalXpForLevel, xpForNextLevel } from "@/features/game/skills";
import {
  MAX_FARM_LEVEL,
  FARM_LEVEL_UPGRADES,
  totalSkillXp,
  USD_COST_PER_LEVEL,
} from "@/features/game/farm-level";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { useFarmToast } from "@/context/ToastContext";

interface ProfileStatsProps {
  data: ProfileData;
}

// ---------------------------------------------------------------------------
// Skill display helpers
// ---------------------------------------------------------------------------

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

const SKILL_ICONS: Record<string, string> = {
  farming:     "/assets/icons/plant.png",
  mining:      "/assets/tools/iron_pickaxe.png",
  woodcutting: "/assets/tools/axe.png",
  fishing:     "/assets/tools/fishing_rod.png",
  husbandry:   "/assets/animals/chicken.png",
  cooking:     "/assets/foods/pumpkin_soup.png",
  smithing:    "/assets/icons/anvil.png",
};

const SKILL_COLORS: Record<string, string> = {
  farming:     "#4ade80",
  woodcutting: "#86efac",
  mining:      "#94a3b8",
  fishing:     "#38bdf8",
  husbandry:   "#fbbf24",
  cooking:     "#fb923c",
  smithing:    "#a3a3a3",
};

const SKILL_ORDER = [
  "farming", "woodcutting", "mining", "fishing",
  "husbandry", "cooking", "smithing",
];

// ---------------------------------------------------------------------------
// Farm upgrade panel
// ---------------------------------------------------------------------------

interface LfrgPriceData {
  priceUsd:      number;
  tokensFor2Usd: number;
  fetchedAt:     number;
  live:          boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function FarmUpgradePanel() {
  const dispatch   = useGameStore((s) => s.dispatch);
  const state      = useGameStore((s) => s.state);
  const { addToast } = useFarmToast();

  const farmLevel   = state.farmLevel ?? 1;
  const coins       = new Decimal(state.coins ?? 0).toNumber();
  const xpTotal     = totalSkillXp(state.skills);
  const nextLevel   = farmLevel + 1;
  const cost        = FARM_LEVEL_UPGRADES[nextLevel];
  const atMax       = farmLevel >= MAX_FARM_LEVEL;

  const { data: priceData, isLoading: priceLoading } = useSWR<LfrgPriceData>(
    atMax ? null : "/api/price/lfrg",
    fetcher,
    { refreshInterval: 60_000 },
  );

  if (atMax) {
    return (
      <InnerPanel className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="font-pixel text-[9px] text-neon text-shadow">Farm Level MAX</span>
        <span className="font-pixel text-[8px] text-white/50">{MAX_FARM_LEVEL} / {MAX_FARM_LEVEL}</span>
      </InnerPanel>
    );
  }

  const lfrgCost     = priceData?.tokensFor2Usd ?? null;
  const meetsXp      = cost ? xpTotal >= cost.xpRequired : false;
  const meetsCoins   = lfrgCost !== null ? coins >= lfrgCost : false;
  const canUpgrade   = meetsXp && meetsCoins && lfrgCost !== null;
  const xpNeeded     = cost ? Math.max(0, cost.xpRequired - xpTotal) : 0;

  const handleUpgrade = () => {
    if (!lfrgCost) return;
    dispatch({ type: "farm.upgrade", lfrgCost });
    addToast(`Farm upgraded to Level ${nextLevel}! (-${lfrgCost} $LFRG)`);
  };

  return (
    <InnerPanel className="flex flex-col gap-2 px-3 py-2">
      {/* Level display */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel text-[9px] text-white text-shadow">Farm Level</span>
        <span className="font-pixel text-[9px] text-neon text-shadow tabular-nums">
          {farmLevel} → {nextLevel}
        </span>
      </div>

      {/* XP requirement */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel text-[8px] text-white/50 uppercase">XP Required</span>
        <span className={`font-pixel text-[8px] tabular-nums text-shadow ${meetsXp ? "text-neon" : "text-rose"}`}>
          {meetsXp
            ? `${xpTotal.toLocaleString()} XP (met)`
            : `Need +${xpNeeded.toLocaleString()} XP`}
        </span>
      </div>

      {/* LFRG cost */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel text-[8px] text-white/50 uppercase">Cost</span>
        <span className={`font-pixel text-[8px] tabular-nums text-shadow ${meetsCoins ? "text-neon" : "text-rose"}`}>
          {priceLoading || lfrgCost === null
            ? "Loading price..."
            : `${lfrgCost.toLocaleString()} $LFRG (~$${USD_COST_PER_LEVEL} USD)`}
        </span>
      </div>

      {/* Coins balance */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel text-[8px] text-white/50 uppercase">Your $LFRG</span>
        <span className="font-pixel text-[8px] tabular-nums text-white/70 text-shadow">
          {coins.toLocaleString()}
        </span>
      </div>

      {/* Price source note */}
      {priceData && (
        <span className="font-pixel text-[7px] text-white/30 leading-relaxed">
          {priceData.live
            ? `Live price: $${priceData.priceUsd.toFixed(6)} USD/LFRG`
            : "Price feed not configured — using fallback rate"}
        </span>
      )}

      {/* Upgrade button */}
      <Button
        onClick={handleUpgrade}
        disabled={!canUpgrade}
        className="w-full mt-1 font-pixel text-[9px]"
      >
        {canUpgrade ? `Upgrade to Farm Lv ${nextLevel}` : "Requirements not met"}
      </Button>
    </InnerPanel>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ProfileStats({ data }: ProfileStatsProps) {
  return (
    <div className="flex flex-col gap-3">

      {/* Farm upgrade */}
      <SectionLabel icon="/assets/buildings/house.png">Farm Upgrade</SectionLabel>
      <FarmUpgradePanel />

      {/* Skills overview */}
      <SectionLabel icon="/assets/icons/plant.png">Skills</SectionLabel>
      <div className="flex flex-col gap-1">
        {SKILL_ORDER.map((skill) => {
          const xp        = data.skills[skill] ?? 0;
          const level     = getSkillLevel(xp);
          const levelXP   = totalXpForLevel(level);
          const nextXP    = xpForNextLevel(level);
          const currentXP = xp - levelXP;
          const pct       = level >= 100 ? 100 : Math.min((currentXP / nextXP) * 100, 100);
          const maxed     = level >= 100;

          const color = SKILL_COLORS[skill] ?? "#4ade80";
          return (
            <InnerPanel key={skill} className="flex items-center gap-2 px-2 py-1.5">
              <img
                src={SKILL_ICONS[skill] ?? "/assets/icons/plant.png"}
                alt=""
                className="w-4 h-4 shrink-0"
                style={{ imageRendering: "pixelated" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-pixel text-[8px] text-white/70 uppercase">
                    {skill.charAt(0).toUpperCase() + skill.slice(1)}
                  </span>
                  <span className="font-pixel text-[9px] tabular-nums text-white text-shadow shrink-0">
                    Lv {level}
                  </span>
                </div>
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="font-pixel text-[7px] text-white/50 tabular-nums">
                  {maxed ? "MAX" : `${currentXP.toLocaleString()} / ${nextXP.toLocaleString()} XP`}
                </span>
              </div>
            </InnerPanel>
          );
        })}
      </div>
    </div>
  );
}

"use client";

/**
 * components/game/quests/components/QuestRow.tsx
 *
 * Full-width quest row for the redesigned Quest Board
 * (docs/modal-redesign-plan.md §3 — Phase D).
 *
 * Layout: category icon plaque · objective + progress bar · reward chips
 * right-aligned · per-row Complete button. Replaces the old QuestCard grid.
 */

import { useEffect, useState } from "react";
import { InnerPanel } from "@/components/ui/Panel";
import type { EmbeddedQuest, QuestCategory, QuestDifficulty } from "@/shared/types/quests";

// ---------------------------------------------------------------------------
// Display maps
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<QuestCategory, string> = {
  farming:     "Farming",
  mining:      "Mining",
  woodcutting: "Woodcutting",
  fishing:     "Fishing",
  cooking:     "Cooking",
  husbandry:   "Husbandry",
};

const CATEGORY_ICON_PATHS: Record<QuestCategory, string> = {
  farming:     "/assets/resources/potato.png",
  mining:      "/assets/resources/stone.png",
  woodcutting: "/assets/resources/wood.png",
  fishing:     "/assets/resources/raw_fish.png",
  cooking:     "/assets/resources/roasted_potato.png",
  husbandry:   "/assets/resources/egg.png",
};

const DIFFICULTY_LABELS: Record<QuestDifficulty, string> = {
  easy:   "Easy",
  normal: "Normal",
  hard:   "Hard",
  expert: "Expert",
};

const DIFFICULTY_BADGE: Record<QuestDifficulty, string> = {
  easy:   "bg-green-800 text-green-200",
  normal: "bg-blue-800 text-blue-200",
  hard:   "bg-orange-800 text-orange-200",
  expert: "bg-red-800 text-red-200",
};

const shardIcon = "/assets/shards/common_shard.png";

// ---------------------------------------------------------------------------
// Countdown hook
// ---------------------------------------------------------------------------

function useCountdown(expiresAt?: number | null) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setLabel("Expired"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return label;
}

// ---------------------------------------------------------------------------
// Reward chip
// ---------------------------------------------------------------------------

function RewardChip({
  icon,
  color = "text-yellow-200",
  children,
}: {
  icon?: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-black/30 leading-none">
      {icon && (
        <img src={icon || "/placeholder.svg"} alt="" className="w-3.5 h-3.5 object-contain pixelated" />
      )}
      <span className={`text-[9px] font-semibold whitespace-nowrap ${color}`}>{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuestRowProps {
  quest:      EmbeddedQuest;
  /** Player inventory items passed from the modal — avoids per-row fetches. */
  inventory:  Record<string, number>;
  onComplete: (questId: string) => void;
  completing: boolean; // true while POST /api/quests/:id/complete is in flight
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestRow({ quest, inventory, onComplete, completing }: QuestRowProps) {
  const countdown   = useCountdown(quest.expiresAt);
  const isExpired   = quest.status === "expired"  || countdown === "Expired";
  const isCompleted = quest.status === "completed";
  const isActive    = !isExpired && !isCompleted;

  const have     = inventory[quest.objective.resource] ?? 0;
  const need     = quest.objective.required;
  const canClaim = isActive && have >= need;
  const deficit  = need - have;

  const totalGuaranteedShards = (quest.rewards.guaranteedShards ?? []).reduce(
    (sum, s) => sum + s.amount,
    0,
  );

  const questId = quest.id;

  return (
    <InnerPanel
      className={[
        "flex flex-col sm:flex-row sm:items-center gap-2 px-2 py-2 text-white font-body",
        (isExpired || isCompleted) ? "opacity-50" : "",
      ].join(" ")}
    >
      {/* ── Category icon plaque ── */}
      <div
        className="hidden sm:flex w-10 h-10 shrink-0 items-center justify-center rounded bg-brown-600/60 border border-brown-600"
        aria-hidden="true"
      >
        <img
          src={CATEGORY_ICON_PATHS[quest.category] || "/placeholder.svg"}
          alt=""
          className="w-6 h-6 object-contain pixelated"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      {/* ── Objective + progress ── */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mobile-only inline icon */}
          <img
            src={CATEGORY_ICON_PATHS[quest.category] || "/placeholder.svg"}
            alt=""
            className="sm:hidden w-4 h-4 object-contain pixelated"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-xs font-semibold text-shadow">
            {CATEGORY_LABELS[quest.category]}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${DIFFICULTY_BADGE[quest.difficulty]}`}>
            {DIFFICULTY_LABELS[quest.difficulty]}
          </span>
        </div>

        <p className="text-xs leading-tight">
          <span className="opacity-80">Deliver </span>
          <span className="font-bold text-yellow-300">{need.toLocaleString()}</span>
          <span className="opacity-80"> {quest.objective.resource}</span>
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-sm h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width:      `${Math.min(100, (have / need) * 100)}%`,
              background: canClaim ? "#4ade80" : "#facc15",
            }}
          />
        </div>
        <div className="flex items-center gap-2 text-[9px]">
          <span className="opacity-70">
            {have.toLocaleString()} / {need.toLocaleString()}
          </span>
          {!canClaim && isActive && (
            <span className="text-yellow-300 font-semibold">
              Need {deficit.toLocaleString()} more
            </span>
          )}
          {canClaim && <span className="text-green-300 font-semibold">Ready</span>}
          {isActive && countdown && (
            <span className="opacity-50">· resets in {countdown}</span>
          )}
        </div>
      </div>

      {/* ── Reward chips + action (right-aligned) ── */}
      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 sm:flex-col sm:items-end">
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <RewardChip icon={shardIcon}>{totalGuaranteedShards}</RewardChip>
          <RewardChip color="text-green-300">+{quest.rewards.skillXp.toLocaleString()} XP</RewardChip>
          <RewardChip color="text-blue-300">{quest.rewards.baseRolls} rolls</RewardChip>
        </div>

        {isCompleted ? (
          <span className="text-[9px] text-green-300 font-semibold px-2">Completed</span>
        ) : isExpired ? (
          <span className="text-[9px] text-red-300 px-2">Expired</span>
        ) : (
          <button
            type="button"
            disabled={!canClaim || completing}
            onClick={() => onComplete(questId)}
            className={[
              "text-[10px] font-bold px-3 py-1.5 rounded transition-all whitespace-nowrap",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400",
              canClaim && !completing
                ? "bg-yellow-400 hover:bg-yellow-300 text-brown-800 cursor-pointer shadow-md active:translate-y-0.5"
                : "bg-black/30 text-white/30 cursor-not-allowed",
            ].join(" ")}
          >
            {completing ? "Claiming..." : "Complete"}
          </button>
        )}
      </div>
    </InnerPanel>
  );
}

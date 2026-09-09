/**
 * components/quests/QuestCard.tsx
 *
 * Single quest card for the QuestKeeper modal. §3.3-A/B/C/D
 *
 * Shows:
 *   - Category badge and difficulty tier. §3.3-B
 *   - Objective: "Deliver N Resource". §3.3-B
 *   - Live inventory count vs required (fetched by parent). §3.3-A
 *   - Guaranteed reward preview: shards + Skill XP + rolls. §3.3-B
 *   - Countdown timer for daily/weekly; "Permanent" for village orders. §3.3-C
 *   - Complete button — enabled when inventory >= required; shows deficit when not. §3.3-A
 */

"use client";

import { useEffect, useState } from "react";
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
// Props
// ---------------------------------------------------------------------------

interface QuestCardProps {
  quest:      EmbeddedQuest;
  /** Player inventory items passed from the modal — avoids per-card fetches. */
  inventory:  Record<string, number>;
  onComplete: (questId: string) => void;
  completing: boolean; // true while POST /api/quests/:id/complete is in flight
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestCard({ quest, inventory, onComplete, completing }: QuestCardProps) {
  const countdown   = useCountdown(quest.expiresAt);
  const isExpired   = quest.status === "expired"  || countdown === "Expired";
  const isCompleted = quest.status === "completed";
  const isActive    = !isExpired && !isCompleted;

  // §3.3-A: live inventory check
  const have     = inventory[quest.objective.resource] ?? 0;
  const need     = quest.objective.required;
  const canClaim = isActive && have >= need;
  const deficit  = need - have;

  const totalGuaranteedShards = (quest.rewards.guaranteedShards ?? []).reduce(
    (sum: number, s: { amount: number }) => sum + s.amount,
    0,
  );

  const questId = quest.id;

  return (
    <article
      className={[
        "flex flex-col gap-2 rounded-lg bg-brown-600 overflow-hidden text-white",
        "font-body text-shadow",
        (isExpired || isCompleted) ? "opacity-50" : "",
      ].join(" ")}
      style={{
        border: "3px solid rgba(0,0,0,0.4)",
        borderRadius: "12px",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 pt-3 gap-2">
        <div className="flex items-center gap-2">
          <img
            src={CATEGORY_ICON_PATHS[quest.category]}
            alt={quest.category}
            className="w-5 h-5"
            style={{ imageRendering: "pixelated" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-sm font-semibold">
            {CATEGORY_LABELS[quest.category]}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Difficulty badge */}
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${DIFFICULTY_BADGE[quest.difficulty]}`}>
            {DIFFICULTY_LABELS[quest.difficulty]}
          </span>
        </div>
      </div>

      {/* ── Objective ── */}
      <div className="px-3 text-sm">
        <span className="opacity-80">Deliver </span>
        <span className="font-bold text-yellow-300">
          {need.toLocaleString()}
        </span>
        <span className="opacity-80"> {quest.objective.resource}</span>
      </div>

      {/* ── Inventory progress ── §3.3-A */}
      <div className="px-3">
        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width:      `${Math.min(100, (have / need) * 100)}%`,
              background: canClaim ? "#4ade80" : "#facc15",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-xs">
          <span className="opacity-70">
            {have.toLocaleString()} / {need.toLocaleString()} in inventory
          </span>
          {!canClaim && isActive && (
            <span className="text-yellow-300 font-semibold">
              Need {deficit.toLocaleString()} more
            </span>
          )}
          {canClaim && (
            <span className="text-green-300 font-semibold">Ready</span>
          )}
        </div>
      </div>

      {/* ── Rewards preview ── §3.3-B */}
      <div className="mx-3 rounded bg-black/20 px-2.5 py-2 flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="opacity-70">Guaranteed frogments</span>
          <span className="font-semibold text-yellow-200">
            {totalGuaranteedShards} Frogments
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="opacity-70">Skill XP</span>
          <span className="font-semibold text-green-300">
            +{quest.rewards.skillXp.toLocaleString()} XP
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="opacity-70">Reward rolls</span>
          <span className="font-semibold text-blue-300">
            {quest.rewards.baseRolls} base rolls
          </span>
        </div>
      </div>

      {/* ── Footer: timer + complete button ── §3.3-C */}
      <div className="px-3 pb-3 flex items-center justify-between gap-2">
        {/* Timer / status */}
        <div className="text-xs opacity-60">
          {isCompleted ? (
            <span className="text-green-300 opacity-100 font-semibold">Completed</span>
          ) : isExpired ? (
            <span className="text-red-300 opacity-100">Expired — new quest at reset</span>
          ) : countdown ? (
            <span>Resets in <span className="font-semibold text-white/90">{countdown}</span></span>
          ) : null}
        </div>

        {/* Complete button — §3.3-A */}
        {isActive && (
          <button
            disabled={!canClaim || completing}
            onClick={() => onComplete(questId)}
            className={[
              "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400",
              canClaim && !completing
                ? "bg-yellow-400 hover:bg-yellow-300 text-brown-800 cursor-pointer shadow-md"
                : "bg-black/30 text-white/30 cursor-not-allowed",
            ].join(" ")}
          >
            {completing ? "Claiming..." : "Complete"}
          </button>
        )}
      </div>
    </article>
  );
}

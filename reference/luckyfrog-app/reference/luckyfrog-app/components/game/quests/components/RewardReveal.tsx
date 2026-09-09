"use client";

/**
 * phaser/features/quests/components/RewardReveal.tsx
 *
 * Reward reveal screen displayed after a successful quest completion. §3.4-D
 *
 * Flow:
 *   1. Guaranteed floor shown immediately (frogments + skill XP).
 *   2. Animated roll cards revealed one-at-a-time (500 ms delay between each).
 *   3. Jackpot rolls get a gold pulse animation and a "JACKPOT!" label.
 *   4. Summary panel shown after all rolls have revealed: total frogments earned.
 *   5. "Collect Rewards" button dismisses the reveal.
 *
 * Reference: docs/implementation_plans/phase-03-quest-system.md §3.4-D
 */

import { useEffect, useRef, useState } from "react";
import type { EmbeddedQuest, FrogmentRollResult } from "@/shared/types/quests";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompletionPayload {
  guaranteed:  EmbeddedQuest["rewards"];
  rolls:       FrogmentRollResult[];
  totalRolls:  number;
}

interface RewardRevealProps {
  payload:     CompletionPayload;
  questName:   string; // e.g. "Daily Farming — Easy"
  onDismiss:   () => void;
}

// ---------------------------------------------------------------------------
// Roll card — flat frogment amount display
// ---------------------------------------------------------------------------

function RollCard({
  result,
  visible,
}: {
  result:  FrogmentRollResult;
  visible: boolean;
}) {
  const isJackpot = result.jackpot === true;

  return (
    <div
      className={[
        "relative rounded-lg border-2 px-3 py-2 flex flex-col items-center gap-1",
        "transition-all duration-300",
        isJackpot
          ? "bg-yellow-700 border-yellow-300 text-yellow-100"
          : "bg-blue-800 border-blue-400 text-blue-100",
        visible ? "opacity-100 scale-100" : "opacity-0 scale-75",
        isJackpot ? "animate-jackpot-pulse" : "",
      ].join(" ")}
      style={{ minWidth: 80 }}
    >
      {/* Roll number */}
      <span className="text-xs opacity-50 absolute top-1 left-2">#{result.roll}</span>

      {/* Jackpot badge */}
      {isJackpot && (
        <span
          className="absolute -top-2 -right-2 text-[10px] font-black px-1.5 py-0.5 rounded
                     bg-yellow-300 text-yellow-900 shadow-lg leading-none z-10"
        >
          JACKPOT
        </span>
      )}

      {/* Frogment icon indicator */}
      <div className="w-2.5 h-2.5 rounded-full mt-3 bg-blue-400" />

      {/* Label */}
      <span className="text-xs font-bold mt-0.5">Frogments</span>

      {/* Amount */}
      <span className="text-base font-black">
        {result.amount.toLocaleString()}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guaranteed row
// ---------------------------------------------------------------------------

function GuaranteedSection({
  rewards,
}: {
  rewards: EmbeddedQuest["rewards"];
}) {
  const totalFrogments = (rewards.guaranteedShards ?? []).reduce((s, g) => s + g.amount, 0);

  return (
    <div className="rounded-lg bg-black/30 px-4 py-3 flex flex-col gap-2">
      <p className="text-xs font-bold text-yellow-300 uppercase tracking-wide">
        Guaranteed Rewards
      </p>
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="font-semibold">{totalFrogments} Frogment{totalFrogments !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="font-semibold">+{rewards.skillXp.toLocaleString()} Skill XP</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary panel — shown after all rolls reveal
// ---------------------------------------------------------------------------

function SummaryPanel({
  rolls,
  guaranteed,
}: {
  rolls:      FrogmentRollResult[];
  guaranteed: EmbeddedQuest["rewards"];
}) {
  const rollTotal = rolls.reduce((sum, r) => sum + r.amount, 0);
  const guaranteedTotal = (guaranteed.guaranteedShards ?? []).reduce((sum, g) => sum + g.amount, 0);
  const grandTotal = rollTotal + guaranteedTotal;
  const jackpots = rolls.filter((r) => r.jackpot).length;

  return (
    <div className="rounded-lg bg-black/30 px-4 py-3 flex flex-col gap-2">
      <p className="text-xs font-bold text-yellow-300 uppercase tracking-wide">
        Total Earned
      </p>
      <div className="flex items-center gap-1.5 text-sm">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <span className="font-semibold">
          {grandTotal.toLocaleString()} Frogment{grandTotal !== 1 ? "s" : ""}
        </span>
      </div>
      {jackpots > 0 && (
        <p className="text-xs text-yellow-300 font-bold">
          {jackpots} jackpot{jackpots !== 1 ? "s" : ""} hit!
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RewardReveal({ payload, questName, onDismiss }: RewardRevealProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allRevealed = visibleCount >= payload.rolls.length;

  // Reveal rolls one-at-a-time with 500 ms delay
  useEffect(() => {
    if (payload.rolls.length === 0) {
      setVisibleCount(0);
      return;
    }

    // Start revealing after a short initial pause
    timerRef.current = setTimeout(() => {
      const reveal = () => {
        setVisibleCount((prev) => {
          if (prev < payload.rolls.length) {
            timerRef.current = setTimeout(reveal, 420);
            return prev + 1;
          }
          return prev;
        });
      };
      reveal();
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [payload.rolls.length]);

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Quest name */}
      <p className="text-center text-sm font-semibold opacity-70">{questName}</p>

      {/* Guaranteed rewards */}
      <GuaranteedSection rewards={payload.guaranteed} />

      {/* Roll cards */}
      {payload.rolls.length > 0 && (
        <div>
          <p className="text-xs font-bold text-blue-300 uppercase tracking-wide mb-2">
            Reward Rolls ({payload.totalRolls})
          </p>
          <div className="flex flex-wrap gap-2">
            {payload.rolls.map((result, idx) => (
              <RollCard
                key={result.roll}
                result={result}
                visible={idx < visibleCount}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reveal-all shortcut */}
      {!allRevealed && payload.rolls.length > 0 && (
        <button
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setVisibleCount(payload.rolls.length);
          }}
          className="text-xs opacity-50 hover:opacity-80 underline self-center transition-opacity"
        >
          Reveal all
        </button>
      )}

      {/* Summary + dismiss */}
      {allRevealed && (
        <>
          <SummaryPanel rolls={payload.rolls} guaranteed={payload.guaranteed} />
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-300
                       text-brown-800 font-black text-sm transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            Collect Rewards
          </button>
        </>
      )}
    </div>
  );
}

"use client";

/**
 * components/game/house/AchievementsPanel.tsx
 *
 * Lists all game achievements grouped by category, showing the player's
 * current progress from the live game store. Completed achievements are
 * highlighted; locked (requires) achievements are dimmed.
 */

import React, { useState } from "react";

import { useGameStore } from "@/lib/stores/game/useGameStore";
import {
  ACHIEVEMENTS,
  type AchievementName,
  type AchievementCategory,
} from "@/shared/types/gameplay/achievements";
import { SectionLabel } from "@/components/ui/modal";

// ---------------------------------------------------------------------------
// Category meta
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<AchievementCategory, { label: string; icon: string; color: string }> = {
  farming:     { label: "Farming",     icon: "/assets/icons/plant.png",           color: "#4ade80" },
  animals:     { label: "Animals",     icon: "/assets/animals/chicken.png",       color: "#fbbf24" },
  gathering:   { label: "Gathering",   icon: "/assets/tools/iron_pickaxe.png",    color: "#94a3b8" },
  economy:     { label: "Economy",     icon: "/assets/icons/luckyfrog_token.png", color: "#f59e0b" },
  progression: { label: "Progression", icon: "/assets/icons/quest.png",           color: "#38bdf8" },
};

const CATEGORY_ORDER: AchievementCategory[] = ["farming", "animals", "gathering", "economy", "progression"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

// ---------------------------------------------------------------------------
// AchievementRow
// ---------------------------------------------------------------------------

interface AchievementRowProps {
  name: AchievementName;
  progress: number;
  completed: boolean;
  locked: boolean;
}

function AchievementRow({ name, progress, completed, locked }: AchievementRowProps) {
  const ach = ACHIEVEMENTS[name];
  const pct = clamp((progress / ach.requirement) * 100, 0, 100);
  const { color } = CATEGORY_META[ach.category];

  return (
    <div
      className={`flex flex-col gap-1 p-2 border border-border/60 transition-opacity ${
        locked ? "opacity-40" : completed ? "opacity-100" : "opacity-80"
      }`}
      style={{
        background: completed
          ? `linear-gradient(90deg, ${color}18 0%, transparent 60%)`
          : "transparent",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {completed && (
            <span
              className="text-[8px] font-pixel shrink-0 px-1 py-0.5 border"
              style={{ color, borderColor: color, background: `${color}22` }}
            >
              DONE
            </span>
          )}
          <span
            className={`font-pixel text-[9px] leading-tight truncate ${
              completed ? "text-white" : locked ? "text-white/40" : "text-white/80"
            }`}
          >
            {locked ? "???" : ach.name}
          </span>
        </div>
        {!locked && (
          <span className="font-pixel text-[8px] text-white/50 shrink-0 tabular-nums">
            {progress.toLocaleString()} / {ach.requirement.toLocaleString()}
          </span>
        )}
      </div>

      {!locked && (
        <p className="font-pixel text-[7px] text-white/40 leading-tight line-clamp-1">
          {ach.description}
        </p>
      )}

      {!locked && !completed && (
        <div className="h-1.5 bg-black/40 overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AchievementsPanel
// ---------------------------------------------------------------------------

export function AchievementsPanel() {
  const gameState = useGameStore((s) => s.state);
  const [activeCategory, setActiveCategory] = useState<AchievementCategory>("farming");

  // achievements is Partial<Record<AchievementName, number>> — keys present
  // with a value >= requirement count as completed.
  const achRecord: Partial<Record<AchievementName, number>> =
    gameState.achievements && typeof gameState.achievements === "object" && !Array.isArray(gameState.achievements)
      ? (gameState.achievements as Partial<Record<AchievementName, number>>)
      : {};

  const completedSet = new Set<AchievementName>(
    (Object.keys(achRecord) as AchievementName[]).filter(
      (n) => (achRecord[n] ?? 0) >= (ACHIEVEMENTS[n]?.requirement ?? Infinity)
    )
  );

  // All achievement names for the active category (exclude hidden unless completed)
  const names = (Object.keys(ACHIEVEMENTS) as AchievementName[]).filter((n) => {
    const ach = ACHIEVEMENTS[n];
    if (ach.category !== activeCategory) return false;
    if (ach.hidden && !completedSet.has(n)) return false;
    return true;
  });

  // Count totals for each category tab
  const categoryCounts = CATEGORY_ORDER.reduce<Record<AchievementCategory, { done: number; total: number }>>(
    (acc, cat) => {
      const catNames = (Object.keys(ACHIEVEMENTS) as AchievementName[]).filter(
        (n) => ACHIEVEMENTS[n].category === cat && !ACHIEVEMENTS[n].hidden
      );
      acc[cat] = {
        done:  catNames.filter((n) => completedSet.has(n)).length,
        total: catNames.length,
      };
      return acc;
    },
    {} as Record<AchievementCategory, { done: number; total: number }>
  );

  return (
    <>
      <SectionLabel icon="/assets/icons/quest.png">Achievements</SectionLabel>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap px-1 pb-1">
        {CATEGORY_ORDER.map((cat) => {
          const { label, icon, color } = CATEGORY_META[cat];
          const { done, total } = categoryCounts[cat];
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1 px-2 py-1 border text-[8px] font-pixel uppercase tracking-wide transition-all duration-75 ${
                isActive
                  ? "border-white/60 text-white bg-white/10"
                  : "border-white/20 text-white/50 bg-transparent hover:border-white/40 hover:text-white/70"
              }`}
            >
              <img
                src={icon}
                alt=""
                className="w-3 h-3 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="hidden sm:inline">{label}</span>
              <span style={{ color: isActive ? color : undefined }}>
                {done}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Achievement list */}
      <div className="flex flex-col gap-1 px-1">
        {names.map((name) => {
          const ach = ACHIEVEMENTS[name];
          // Check if prerequisites are met
          const locked = !!(
            ach.requires && ach.requires.some((req) => !completedSet.has(req))
          );
          const rawProgress = completedSet.has(name)
            ? ach.requirement
            : (achRecord[name] ?? 0);
          const progress = typeof rawProgress === "number" ? rawProgress : 0;

          return (
            <AchievementRow
              key={name}
              name={name}
              progress={progress}
              completed={completedSet.has(name)}
              locked={locked}
            />
          );
        })}
        {names.length === 0 && (
          <p className="font-pixel text-[9px] text-white/40 text-center py-4">
            No achievements in this category.
          </p>
        )}
      </div>
    </>
  );
}

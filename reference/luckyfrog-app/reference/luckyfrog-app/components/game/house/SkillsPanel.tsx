"use client";

/**
 * components/game/house/SkillsPanel.tsx
 *
 * Skill levels & XP list, extracted from the old AvatarMenu "Skills" view so it
 * can live on the House modal's Player tab (see docs/modal-redesign-plan.md §3).
 * Reads live XP per category from useGameStore and renders an icon + label +
 * level + XP progress bar per skill.
 */

import React from "react";

import { useGameStore } from "@/lib/stores/game/useGameStore";
import { getSkillLevel, getSkillXPForLevel, getSkillXPToNextLevel } from "@/shared/game/skills";
import { INITIAL_SKILLS, type SkillCategory } from "@/shared/types/gameplay/skills";
import { SectionLabel } from "@/components/ui/modal";

// §C5 — canonical server skill names
const SKILL_META: Record<SkillCategory, { label: string; icon: string; color: string }> = {
  farming:     { label: "Farming",     icon: "/assets/icons/plant.png",        color: "#4ade80" },
  woodcutting: { label: "Woodcutting", icon: "/assets/tools/axe.png",          color: "#86efac" },
  mining:      { label: "Mining",      icon: "/assets/tools/iron_pickaxe.png", color: "#94a3b8" },
  fishing:     { label: "Fishing",     icon: "/assets/tools/fishing_rod.png",  color: "#38bdf8" },
  cooking:     { label: "Cooking",     icon: "/assets/icons/hammer.png",       color: "#fb923c" },
  combat:      { label: "Combat",      icon: "/assets/icons/heart.png",        color: "#f87171" },
  husbandry:   { label: "Husbandry",   icon: "/assets/animals/chicken.png",    color: "#fbbf24" },
};

export const SKILL_ORDER: SkillCategory[] = ["farming", "woodcutting", "mining", "fishing", "cooking", "combat", "husbandry"];

/** Sum of all skill levels — used by the AvatarMenu hero card. */
export function getTotalSkillLevels(skills: Record<string, number>): number {
  return SKILL_ORDER.reduce((sum, cat) => sum + getSkillLevel(skills[cat] ?? 0), 0);
}

function SkillRow({ category, xp }: { category: SkillCategory; xp: number }) {
  const { label, icon, color } = SKILL_META[category];
  const level        = getSkillLevel(xp);
  const levelStartXP = getSkillXPForLevel(level);
  const neededXP     = getSkillXPToNextLevel(level);
  const progressXP   = xp - levelStartXP;
  const pct          = level >= 100 ? 100 : Math.min((progressXP / neededXP) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <img src={icon || "/placeholder.svg"} alt={label} className="w-5 h-5 flex-shrink-0" style={{ imageRendering: "pixelated" }} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="text-white text-xs text-shadow">{label}</span>
          <span className="text-white text-xs text-shadow opacity-75">Lv.{level}</span>
        </div>
        <div className="h-2 bg-black bg-opacity-40 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-white text-xs opacity-60">
          {progressXP.toLocaleString()} / {neededXP.toLocaleString()} XP
        </span>
      </div>
    </div>
  );
}

/** Skill levels & XP list, driven by the live game store. */
export function SkillsPanel() {
  const skills = useGameStore((s) => s.state.skills ?? INITIAL_SKILLS);

  return (
    <>
      <SectionLabel icon="/assets/icons/plant.png">Skills</SectionLabel>
      <div className="flex flex-col gap-3 p-1">
        {SKILL_ORDER.map((cat) => (
          <SkillRow key={cat} category={cat} xp={skills[cat] ?? 0} />
        ))}
      </div>
    </>
  );
}

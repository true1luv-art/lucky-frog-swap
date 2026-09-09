"use client";

/**
 * components/game/house/HouseModal.tsx
 *
 * House modal with four NavRail tabs:
 *   Player       — ProfileClient (mining stats, collection, top frogs)
 *   Skills       — SkillsPanel (XP / level per skill category)
 *   Achievements — AchievementsPanel (all game achievements + progress)
 *   Gear         — GearPanel (equipped items)
 */

import { useState } from "react";
import { ModalShell, ModalTitleBar, NavRail } from "@/components/ui/modal";
import { SkillsPanel } from "@/components/game/house/SkillsPanel";
import { GearPanel } from "@/components/game/house/GearPanel";
import { AchievementsPanel } from "@/components/game/house/AchievementsPanel";
import { ProfileClient } from "@/components/game/house/ProfileClient";

const houseIcon        = "/assets/buildings/house.png";
const playerIcon       = "/assets/icons/player.png";
const skillsIcon       = "/assets/icons/plant.png";
const achievementsIcon = "/assets/icons/quest.png";
const gearIcon         = "/assets/icons/heart.png";

type HouseSection = "player" | "skills" | "achievements" | "gear";

const SECTIONS = [
  { id: "player",       label: "Player",       icon: playerIcon       },
  { id: "skills",       label: "Skills",       icon: skillsIcon       },
  { id: "achievements", label: "Achievements", icon: achievementsIcon },
  { id: "gear",         label: "Gear",         icon: gearIcon         },
];

const SECTION_SUBTITLES: Record<HouseSection, string> = {
  player:       "Player profile",
  skills:       "Skill levels & XP",
  achievements: "Game achievements",
  gear:         "Equipped items",
};

interface HouseModalProps {
  open: boolean;
  onClose: () => void;
  wallet: string;
}

export function HouseModal({ open, onClose, wallet }: HouseModalProps) {
  const [section, setSection] = useState<HouseSection>("player");

  return (
    <ModalShell
      show={open}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={houseIcon}
          title="House"
          subtitle={SECTION_SUBTITLES[section]}
          onClose={onClose}
        />
      }
      navRail={
        <NavRail
          items={SECTIONS}
          activeId={section}
          onSelect={(id) => setSection(id as HouseSection)}
        />
      }
      bodyClassName="gap-2 p-0.5"
    >
      {section === "player"       && <ProfileClient wallet={wallet} isOwner={true} />}
      {section === "skills"       && <SkillsPanel />}
      {section === "achievements" && <AchievementsPanel />}
      {section === "gear"         && <GearPanel />}
    </ModalShell>
  );
}

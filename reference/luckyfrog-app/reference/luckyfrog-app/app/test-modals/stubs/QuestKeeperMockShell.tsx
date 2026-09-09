"use client";

/**
 * app/test-modals/stubs/QuestKeeperMockShell.tsx
 *
 * Phase D test harness for the redesigned Quest Board.
 *
 * Renders the same ModalShell + NavRail + QuestRow layout as
 * QuestKeeperContent but bypasses all SWR fetches by feeding MOCK_*
 * data directly. "Complete" buttons that are ready show a static
 * RewardReveal using MOCK_REWARD_REVEAL — no real API calls are made.
 *
 * Village orders have been removed. §fold-quests design decision.
 */

import { useState }     from "react";
import { ModalShell, ModalTitleBar, NavRail, ActionDock } from "@/components/ui/modal";
import { QuestRow }     from "@/components/game/quests/components/QuestRow";
import { RewardReveal } from "@/components/game/quests/components/RewardReveal";
import type { EmbeddedQuest } from "@/shared/types/quests";

import {
  MOCK_DAILY_QUESTS,
  MOCK_WEEKLY_QUESTS,
  MOCK_INVENTORY,
} from "@/app/test-modals/mockup-data";

const questIcon = "/assets/icons/quest.png";

// ---------------------------------------------------------------------------
// Static mock reward reveal payload (mirrors CompletionPayload shape)
// ---------------------------------------------------------------------------

const MOCK_REWARD_REVEAL = {
  guaranteed: {
    guaranteedShards: [{ rarity: "common" as const, amount: 10 }],
    skillXp:    400,
    baseRolls:  6,
  },
  rolls: [
    { roll: 1, rarity: "common"    as const, amount: 5, jackpot: false },
    { roll: 2, rarity: "uncommon"  as const, amount: 3, jackpot: false },
    { roll: 3, rarity: "rare"      as const, amount: 1, jackpot: false },
    { roll: 4, rarity: "epic"      as const, amount: 1, jackpot: true  },
    { roll: 5, rarity: "uncommon"  as const, amount: 2, jackpot: false },
    { roll: 6, rarity: "common"    as const, amount: 4, jackpot: false },
  ],
  totalRolls: 6,
};

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

type QuestSectionId = "daily" | "weekly";

const SECTIONS = [
  { id: "daily",  label: "Daily",  icon: "/assets/icons/stopwatch.png" },
  { id: "weekly", label: "Weekly", icon: "/assets/icons/timer.png" },
];

const SECTION_META: Record<QuestSectionId, { title: string; subtitle: string; quests: EmbeddedQuest[] }> = {
  daily:  { title: "Daily Quests",  subtitle: "One per skill category. Reset at midnight UTC.",               quests: MOCK_DAILY_QUESTS },
  weekly: { title: "Weekly Quest",  subtitle: "Harder delivery — resets every Monday at midnight UTC.",       quests: MOCK_WEEKLY_QUESTS },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuestKeeperMockShellProps {
  open:    boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestKeeperMockShell({ open, onClose }: QuestKeeperMockShellProps) {
  const [section, setSection]       = useState<QuestSectionId>("daily");
  const [completing, setCompleting] = useState<string | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [revealName, setRevealName] = useState("");

  function handleComplete(questId: string) {
    const all = [...MOCK_DAILY_QUESTS, ...MOCK_WEEKLY_QUESTS];
    const q   = all.find((x) => x.id === questId);
    if (q) {
      const cat  = q.category.charAt(0).toUpperCase() + q.category.slice(1);
      const type = q.id.startsWith("mock-weekly") ? "Weekly Quest" : "Daily Quest";
      const diff = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);
      setRevealName(`${type} — ${cat} (${diff})`);
    }
    setCompleting(questId);
    setTimeout(() => {
      setCompleting(null);
      setShowReveal(true);
    }, 600);
  }

  function handleRevealDismiss() {
    setShowReveal(false);
    setRevealName("");
  }

  const meta = SECTION_META[section];

  return (
    <ModalShell
      show={open}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={questIcon}
          title="Quest Board"
          subtitle={meta.title}
          extra={
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-800/60 text-yellow-300 border border-yellow-700/40">
              MOCK DATA
            </span>
          }
          onClose={onClose}
        />
      }
      navRail={
        showReveal ? undefined : (
          <NavRail
            items={SECTIONS}
            activeId={section}
            onSelect={(id) => setSection(id as QuestSectionId)}
          />
        )
      }
      actionDock={
        showReveal ? undefined : (
          <ActionDock
            info={
              <span className="truncate">
                Daily reset in 6h 12m · Weekly reset in 2d 6h
              </span>
            }
          />
        )
      }
    >
      {showReveal ? (
        <RewardReveal
          payload={MOCK_REWARD_REVEAL}
          questName={revealName}
          onDismiss={handleRevealDismiss}
        />
      ) : (
        <div className="flex flex-col gap-2 p-0.5">
          <p className="text-[10px] text-white/60 px-0.5">{meta.subtitle}</p>
          {meta.quests.length === 0 ? (
            <p className="text-xs opacity-50 italic px-0.5 py-4">No quests available.</p>
          ) : (
            meta.quests.map((q) => (
              <QuestRow
                key={q.id}
                quest={q}
                inventory={MOCK_INVENTORY}
                onComplete={handleComplete}
                completing={completing === q.id}
              />
            ))
          )}
        </div>
      )}
    </ModalShell>
  );
}

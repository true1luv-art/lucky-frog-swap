"use client";

/**
 * app/test-modals/stubs/QuestKeeperMockShell.tsx
 *
 * Test harness for the Quest Board — daily quests only.
 * Weekly quests have been removed. §fold-quests design decision.
 *
 * Renders the same ModalShell + QuestRow layout as QuestKeeperContent but
 * bypasses all SWR fetches by feeding MOCK_* data directly. "Complete"
 * buttons that are ready show a static RewardReveal — no real API calls made.
 */

import { useState }     from "react";
import { ModalShell, ModalTitleBar, ActionDock } from "@/components/ui/modal";
import { QuestRow }     from "@/features/game-components/quests/components/QuestRow";
import { RewardReveal } from "@/features/game-components/quests/components/RewardReveal";

import {
  MOCK_DAILY_QUESTS,
  MOCK_INVENTORY,
} from "@/app/test-modals/mockup-data";

const questIcon = "/assets/icons/quest.png";

const MOCK_REWARD_REVEAL = {
  skillXp:     400,
  goldAwarded: 3,
  seedAwarded: null,
};

interface QuestKeeperMockShellProps {
  open:    boolean;
  onClose: () => void;
}

export function QuestKeeperMockShell({ open, onClose }: QuestKeeperMockShellProps) {
  const [completing, setCompleting] = useState<string | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [revealName, setRevealName] = useState("");

  function handleComplete(questId: string) {
    const q = MOCK_DAILY_QUESTS.find((x) => x.id === questId);
    if (q) {
      const cat  = q.category.charAt(0).toUpperCase() + q.category.slice(1);
      const diff = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);
      setRevealName(`Daily Quest — ${cat} (${diff})`);
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

  return (
    <ModalShell
      show={open}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={questIcon}
          title="Quest Board"
          subtitle="Daily Quests"
          extra={
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-800/60 text-yellow-300 border border-yellow-700/40">
              MOCK DATA
            </span>
          }
          onClose={onClose}
        />
      }
      actionDock={
        showReveal ? undefined : (
          <ActionDock
            info={
              <span className="truncate">
                Resets in 6h 12m
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
          <p className="text-[10px] text-white/60 px-0.5">
            One per skill category. Resets at midnight UTC.
          </p>
          {MOCK_DAILY_QUESTS.map((q) => (
            <QuestRow
              key={q.id}
              quest={q}
              inventory={MOCK_INVENTORY}
              onComplete={handleComplete}
              completing={completing === q.id}
            />
          ))}
        </div>
      )}
    </ModalShell>
  );
}

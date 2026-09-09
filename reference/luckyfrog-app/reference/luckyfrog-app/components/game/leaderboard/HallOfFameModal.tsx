"use client";

/**
 * components/game/leaderboard/HallOfFameModal.tsx
 *
 * Hall of Fame — miners leaderboard only.
 * Collectors tab removed in Phase 3 of docs/game-cleanup-plan.md.
 */

import { ModalShell, ModalTitleBar } from "@/components/ui/modal";
import { LeaderboardClient } from "@/components/game/leaderboard/LeaderboardClient";

const hallIcon = "/assets/buildings/hall_of_fame.gif";

interface HallOfFameModalProps {
  open:    boolean;
  onClose: () => void;
  wallet:  string;
}

export function HallOfFameModal({ open, onClose, wallet }: HallOfFameModalProps) {
  return (
    <ModalShell
      show={open}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={hallIcon}
          title="Hall of Fame"
          subtitle="Top miners by collection power"
          onClose={onClose}
        />
      }
      bodyClassName="px-1 pb-1"
    >
      <LeaderboardClient wallet={wallet} activeTab="miners" />
    </ModalShell>
  );
}

import React, { useEffect } from "react";

import { GameHudDock } from "@/features/game-components/hud/components/GameHudDock";
import { VisitBanner } from "@/features/game-components/hud/components/VisitBanner";
import { FishingCooldown } from "@/features/game-components/fishing/components/FishingCooldown";
import { TutorialWizard } from "@/features/game-components/tutorial/TutorialWizard";
import { useTutorialStore } from "@/features/game-stores/useTutorialStore";

/**
 * Heads-up display — small overlayed panel showing balance, inventory, and status.
 * On first visit (no localStorage key) the tutorial wizard opens automatically.
 */
export const Hud: React.FC<{ wallet?: string }> = ({ wallet }) => {
  const { openTutorial, hasSeenTutorial } = useTutorialStore();

  useEffect(() => {
    if (!hasSeenTutorial()) {
      openTutorial();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-html2canvas-ignore="true" aria-label="Hud">
      <GameHudDock wallet={wallet} />
      <VisitBanner />
      <FishingCooldown />
      <TutorialWizard />
    </div>
  );
};

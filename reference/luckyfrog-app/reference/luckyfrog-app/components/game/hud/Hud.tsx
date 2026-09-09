import React from "react";

import { PlayerHud } from "@/components/game/hud/components/PlayerHud";
import { Inventory } from "@/components/game/hud/components/Inventory";
import { VisitBanner } from "@/components/game/hud/components/VisitBanner";
import { FishingCooldown } from "@/components/game/fishing/components/FishingCooldown";

/**
 * Heads-up display — small overlayed panel showing balance, inventory, and status.
 */
export const Hud: React.FC<{ wallet?: string }> = ({ wallet }) => {
  return (
    <div data-html2canvas-ignore="true" aria-label="Hud">
      <PlayerHud wallet={wallet} />
      <Inventory wallet={wallet} />
      <VisitBanner />
      <FishingCooldown />
    </div>
  );
};

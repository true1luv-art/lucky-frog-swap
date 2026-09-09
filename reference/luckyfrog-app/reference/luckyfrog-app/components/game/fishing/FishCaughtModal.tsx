"use client";

/**
 * components/game/fishing/FishCaughtModal.tsx
 *
 * Fish-caught reveal on the new ModalShell (Phase F of
 * docs/modal-redesign-plan.md): toast tier, single reveal card, 4s
 * auto-close with a thin countdown bar along the bottom edge of the
 * ActionDock.
 */

import React, { useEffect } from "react";

import { InnerPanel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ModalShell, ModalTitleBar, ActionDock, SectionLabel } from "@/components/ui/modal";
import { FishName } from "@/shared/types/gameplay/fish";
import { SKILL_XP } from "@/shared/game/skills";

interface Props {
  fish: FishName;
  amount: number;
  onClose: () => void;
}

const XP_PER_CATCH = SKILL_XP.catch_fish;
const AUTO_CLOSE_MS = 4000;

const FISH_ART = "/assets/fish/fish.png";

export const FishCaughtModal: React.FC<Props> = ({ fish, amount, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  const totalXP = XP_PER_CATCH * amount;
  const label = amount > 1 ? `${amount}x ${fish}` : fish;

  return (
    <ModalShell
      show
      onClose={onClose}
      tier="toast"
      titleBar={
        <ModalTitleBar icon={FISH_ART} title="Nice Catch!" onClose={onClose} />
      }
      actionDock={
        <div className="relative shrink-0">
          <ActionDock
            info={
              <span className="text-neon tabular-nums text-shadow whitespace-nowrap">
                +{totalXP} Fishing XP
              </span>
            }
          >
            <Button onClick={onClose}>
              <span className="text-white text-xs text-shadow uppercase tracking-wide">
                Collect
              </span>
            </Button>
          </ActionDock>
          {/* Auto-close countdown bar along the bottom edge of the dock */}
          <div
            className="absolute bottom-0 left-1 right-1 h-0.5 overflow-hidden rounded-full bg-black/40"
            aria-hidden="true"
          >
            <div
              className="h-full bg-gold fish-caught-countdown"
              style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }}
            />
          </div>
        </div>
      }
      bodyClassName="w-[min(88vw,336px)] p-0.5"
    >
      {/* Reveal card */}
      <InnerPanel className="flex flex-col items-center gap-3 p-4">
        <SectionLabel>Fish Caught</SectionLabel>

        {/* Art with a soft water-blue glow */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(96, 165, 250, 0.35) 0%, transparent 70%)",
            }}
          />
          <img
            src={FISH_ART || "/placeholder.svg"}
            alt={fish}
            className="relative h-16 w-16 object-contain pixelated img-highlight"
          />
        </div>

        <span className="text-sm text-white text-shadow text-center">{label}</span>
      </InnerPanel>
    </ModalShell>
  );
};

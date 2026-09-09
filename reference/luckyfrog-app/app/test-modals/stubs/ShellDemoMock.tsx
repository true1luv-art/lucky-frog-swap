"use client";

/**
 * app/test-modals/stubs/ShellDemoMock.tsx
 *
 * Temporary Phase A demo — mounts an empty ModalShell in all three size
 * tiers to verify the shared shell foundation (docs/modal-redesign-plan.md §4).
 * Remove once real modals have migrated onto the shell.
 */

import { useState } from "react";
import {
  ModalShell,
  ModalTitleBar,
  NavRail,
  ActionDock,
  SectionLabel,
  StatChip,
  type ModalTier,
} from "@/components/ui/modal";
import { InnerPanel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

const ICONS = {
  basket: "/assets/icons/basket.png",
  hammer: "/assets/icons/hammer.png",
  plant: "/assets/icons/plant.png",
  quest: "/assets/icons/quest.png",
  token: "/assets/icons/token.png",
  timer: "/assets/icons/timer.png",
  heart: "/assets/icons/heart.png",
};

const NAV_ITEMS = [
  { id: "one", label: "Section 1", icon: ICONS.basket },
  { id: "two", label: "Section 2", icon: ICONS.hammer },
  { id: "three", label: "Section 3", icon: ICONS.plant },
];

interface Props {
  open: boolean;
  tier: ModalTier;
  onClose: () => void;
}

function DemoBody({ section }: { section: string }) {
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap px-0.5 pt-0.5">
        <SectionLabel icon={ICONS.quest}>Demo · {section}</SectionLabel>
      </div>

      <div className="flex gap-1 flex-wrap">
        <StatChip icon={ICONS.token} value="1,234" caption="coins" />
        <StatChip icon={ICONS.timer} value="00:42" caption="Timer" />
        <StatChip icon={ICONS.heart} value="87 / 100" caption="Health" />
      </div>

      <InnerPanel className="flex-1 min-h-24 flex items-center justify-center p-4">
        <p className="text-[10px] text-white/60 text-center text-balance">
          Body content area — scrolls independently.
          <br />
          Active section: {section}
        </p>
      </InnerPanel>

      <InnerPanel className="min-h-16 flex items-center justify-center p-4">
        <p className="text-[10px] text-white/40">Second content section</p>
      </InnerPanel>
    </>
  );
}

export function ShellDemoMock({ open, tier, onClose }: Props) {
  const [section, setSection] = useState("one");

  if (tier === "toast") {
    return (
      <ModalShell
        show={open}
        onClose={onClose}
        tier="toast"
        actionDock={
          <ActionDock>
            <Button onClick={onClose} className="px-4 text-xs">
              Continue
            </Button>
          </ActionDock>
        }
      >
        <InnerPanel className="flex flex-col items-center gap-2 p-4">
          <img
            src={ICONS.token || "/placeholder.svg"}
            alt="Reward"
            className="w-12 h-12 object-contain pixelated"
          />
          <SectionLabel>Toast Tier</SectionLabel>
          <p className="text-[10px] text-white/70 text-center">Reveal card content</p>
        </InnerPanel>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      show={open}
      onClose={onClose}
      tier={tier}
      titleBar={
        <ModalTitleBar
          icon={ICONS.basket}
          title={tier === "fullscreen" ? "Fullscreen Shell" : "Panel Shell"}
          subtitle="Phase A demo"
          onClose={onClose}
          extra={
            tier === "fullscreen" ? (
              <SectionLabel icon={ICONS.token}>1,234</SectionLabel>
            ) : undefined
          }
        />
      }
      navRail={<NavRail items={NAV_ITEMS} activeId={section} onSelect={setSection} />}
      actionDock={
        <ActionDock info={<span>Context info · stock 12</span>}>
          <Button onClick={onClose} className="px-3 text-xs w-auto">
            Secondary
          </Button>
          <Button onClick={onClose} className="px-3 text-xs w-auto">
            Primary
          </Button>
        </ActionDock>
      }
    >
      <DemoBody section={section} />
    </ModalShell>
  );
}

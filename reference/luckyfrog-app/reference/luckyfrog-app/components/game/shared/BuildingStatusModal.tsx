"use client";

/**
 * components/game/shared/BuildingStatusModal.tsx
 *
 * Generic modal shown when a building is disabled via BUILDING_CONFIG.
 * Supports two modes:
 *   "coming-soon"  — feature is planned but not yet available
 *   "maintenance"  — temporarily taken offline
 *
 * Uses the same ModalShell + ModalTitleBar pattern as all other game modals.
 */

import { ModalShell, ModalTitleBar } from "@/components/ui/modal";
import type { DisabledMode } from "@/lib/config/buildings";

const shrineIcon = "/assets/buildings/hatchery.png";

const CONTENT: Record<Exclude<DisabledMode, "hidden">, { title: string; body: string }> = {
  "coming-soon": {
    title: "Coming Soon",
    body:  "This feature is currently under construction. Check back soon!",
  },
  maintenance: {
    title: "Under Maintenance",
    body:  "This building is temporarily offline. We'll have it back up shortly.",
  },
};

interface BuildingStatusModalProps {
  open:         boolean;
  onClose:      () => void;
  mode:         Exclude<DisabledMode, "hidden">;
  buildingName: string;
  /** Optional icon path — falls back to the hatchery/shrine sprite */
  icon?:        string;
}

export function BuildingStatusModal({
  open,
  onClose,
  mode,
  buildingName,
  icon,
}: BuildingStatusModalProps) {
  const content = CONTENT[mode];

  return (
    <ModalShell
      show={open}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={icon ?? shrineIcon}
          title={buildingName}
          subtitle={content.title}
          onClose={onClose}
        />
      }
    >
      <div className="flex flex-col items-center gap-4 px-4 py-6 text-center">
        <p
          className="text-sm text-white/80 leading-relaxed max-w-xs"
          style={{ fontFamily: "var(--font-press-start)", fontSize: "10px", lineHeight: "1.8" }}
        >
          {content.body}
        </p>
      </div>
    </ModalShell>
  );
}

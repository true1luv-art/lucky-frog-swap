

/**
 * components/ui/BuildingStatusModal.tsx
 *
 * General-purpose game status / confirmation modal. Supports three modes:
 *   "coming-soon"  — feature is planned but not yet available
 *   "maintenance"  — temporarily taken offline
 *   "confirm"      — travel / action confirmation with a proceed button
 *
 * Uses the same ModalShell + ModalTitleBar + ActionDock pattern as all other
 * game modals.
 */

import { ModalShell, ModalTitleBar } from "@/components/ui/modal";
import { ActionDock }                from "@/components/ui/modal/ActionDock";
import { Button }                    from "@/components/ui/Button";
import type { DisabledMode }         from "@/lib/config/buildings";

const shrineIcon = "/assets/buildings/hatchery.png";

type ModalMode = Exclude<DisabledMode, "hidden"> | "confirm";

const CONTENT: Record<ModalMode, { title: string; body: string }> = {
  "coming-soon": {
    title: "Coming Soon",
    body:  "This feature is currently under construction. Check back soon!",
  },
  maintenance: {
    title: "Under Maintenance",
    body:  "This building is temporarily offline. We'll have it back up shortly.",
  },
  confirm: {
    title: "Travel",
    body:  "Are you ready to head there?",
  },
};

interface BuildingStatusModalProps {
  open:         boolean;
  onClose:      () => void;
  mode:         ModalMode;
  buildingName: string;
  /** Optional icon path — falls back to the hatchery/shrine sprite */
  icon?:        string;
  /** Confirm mode: label for the proceed button. Defaults to "Proceed". */
  confirmLabel?: string;
  /** Confirm mode: called when the player clicks the proceed button. */
  onConfirm?:   () => void;
}

export function BuildingStatusModal({
  open,
  onClose,
  mode,
  buildingName,
  icon,
  confirmLabel = "Proceed",
  onConfirm,
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
      actionDock={
        mode === "confirm" ? (
          <ActionDock>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => {
                onClose();
                onConfirm?.();
              }}
            >
              {confirmLabel}
            </Button>
          </ActionDock>
        ) : undefined
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

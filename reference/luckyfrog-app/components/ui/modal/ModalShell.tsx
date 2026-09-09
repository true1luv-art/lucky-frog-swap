"use client";

import React from "react";
import classNames from "classnames";
import { Modal } from "react-bootstrap";
import { OuterPanel } from "@/components/ui/Panel";

export type ModalTier = "toast" | "panel" | "fullscreen";

interface Props {
  show: boolean;
  onClose: () => void;
  /** Size tier — see docs/modal-redesign-plan.md §2.1 */
  tier?: ModalTier;
  /** <ModalTitleBar /> */
  titleBar?: React.ReactNode;
  /** <NavRail /> — rendered to the left of the body */
  navRail?: React.ReactNode;
  /** <ActionDock /> — rendered as the footer */
  actionDock?: React.ReactNode;
  /** Scrollable body content */
  children?: React.ReactNode;
  bodyClassName?: string;
  /** Prevent closing via backdrop / Escape (toasts with auto-close, flows) */
  static?: boolean;
}

const TIER_DIALOG_CLASS: Record<ModalTier, string> = {
  toast: "modal-shell-toast",
  panel: "modal-shell-panel",
  fullscreen: "modal-shell-fullscreen",
};

/**
 * Shared modal shell — one OuterPanel frame with titleBar / navRail /
 * body / actionDock slots. Replaces the copy-pasted `pt-5 relative`
 * SFL header pattern in every modal (docs/modal-redesign-plan.md §2.2).
 *
 * ┌ OuterPanel ────────────────────────────┐
 * │ [TitleBar]                             │
 * │ [NavRail] [Body (scrollable)]          │
 * │ [ActionDock]                           │
 * └────────────────────────────────────────┘
 */
export const ModalShell: React.FC<Props> = ({
  show,
  onClose,
  tier = "panel",
  titleBar,
  navRail,
  actionDock,
  children,
  bodyClassName,
  static: isStatic,
}) => {
  const isFullscreen = tier === "fullscreen";

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered={!isFullscreen}
      dialogClassName={TIER_DIALOG_CLASS[tier]}
      contentClassName={isFullscreen ? "h-full" : undefined}
      backdrop={isStatic ? "static" : true}
      keyboard={!isStatic}
    >
      <OuterPanel
        className={classNames(
          "flex flex-col gap-1 overflow-hidden",
          isFullscreen ? "w-full h-full" : "max-h-[82vh]"
        )}
        style={isFullscreen ? { borderRadius: 0 } : undefined}
      >
        {titleBar}

        <div className="flex flex-1 min-h-0 gap-1">
          {navRail}
          <div
            className={classNames(
              "flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col gap-1",
              bodyClassName
            )}
          >
            {children}
          </div>
        </div>

        {actionDock}
      </OuterPanel>
    </Modal>
  );
};

import React from "react";
import { InnerPanel } from "@/components/ui/Panel";

const closeIcon = "/assets/icons/close.png";

interface Props {
  /** Optional icon rendered in a square plaque on the left */
  icon?: string;
  title: string;
  subtitle?: string;
  /** Extra content between the title and the close button (chips, balances…) */
  extra?: React.ReactNode;
  onClose?: () => void;
}

/**
 * Full-width InnerPanel strip inside the modal frame.
 * Replaces the SFL border-flap tabs + floated close icon
 * (see docs/modal-redesign-plan.md §2.2).
 */
export const ModalTitleBar: React.FC<Props> = ({ icon, title, subtitle, extra, onClose }) => {
  return (
    <InnerPanel className="flex items-center gap-2 px-1.5 py-1 shrink-0">
      {icon && (
        <div
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded bg-brown-600/60 border border-brown-600"
          aria-hidden="true"
        >
          <img src={icon || "/placeholder.svg"} alt="" className="w-6 h-6 object-contain pixelated" />
        </div>
      )}

      <div className="flex flex-col min-w-0 flex-1">
        <h2
          className="text-[11px] sm:text-xs text-white text-shadow uppercase tracking-wide leading-tight truncate"
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-[9px] text-white/60 leading-tight truncate">{subtitle}</p>
        )}
      </div>

      {extra && <div className="flex items-center gap-1.5 shrink-0">{extra}</div>}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded bg-brown-600/60 border border-brown-600 hover:brightness-125 active:translate-y-0.5 cursor-pointer transition-all duration-75"
        >
          <img src={closeIcon || "/placeholder.svg"} alt="" className="w-4 h-4 object-contain pixelated" />
        </button>
      )}
    </InnerPanel>
  );
};

import React from "react";
import classNames from "classnames";

interface Props {
  icon?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Small gold label chip for content section headings.
 * Replaces the SFL green outline labels (see docs/modal-redesign-plan.md §2.2).
 */
export const SectionLabel: React.FC<Props> = ({ icon, className, children }) => {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded",
        "bg-[#3a2410] text-yellow-400 border border-yellow-900",
        "text-[9px] uppercase tracking-wide leading-none",
        className
      )}
      style={{ fontFamily: "var(--font-press-start)" }}
    >
      {icon && (
        <img src={icon || "/placeholder.svg"} alt="" className="w-3.5 h-3.5 object-contain pixelated" />
      )}
      {children}
    </span>
  );
};

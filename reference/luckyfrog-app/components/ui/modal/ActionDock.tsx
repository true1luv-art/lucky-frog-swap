import React from "react";
import classNames from "classnames";
import { InnerPanel } from "@/components/ui/Panel";

interface Props {
  /** Context info shown on the left (stock counts, timers, totals…) */
  info?: React.ReactNode;
  /** Action buttons (right-aligned) */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Footer action strip — primary actions (Buy, Sell, Claim, Equip…) always
 * live here, never floated inside content (see docs/modal-redesign-plan.md §2.2).
 * Grammar: identify (top) → browse (middle) → act (bottom).
 */
export const ActionDock: React.FC<Props> = ({ info, children, className }) => {
  return (
    <InnerPanel
      className={classNames(
        "flex items-center justify-between gap-2 px-1.5 py-1 shrink-0",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0 text-[10px] text-white/70">
        {info}
      </div>
      {children && (
        <div className="flex items-center gap-1.5 shrink-0">{children}</div>
      )}
    </InnerPanel>
  );
};

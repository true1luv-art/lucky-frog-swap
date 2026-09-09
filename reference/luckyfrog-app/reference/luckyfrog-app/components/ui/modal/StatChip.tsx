import React from "react";
import classNames from "classnames";
import { InnerPanel } from "@/components/ui/Panel";

interface Props {
  icon?: string;
  value: React.ReactNode;
  caption: string;
  className?: string;
}

/**
 * Icon + value + caption InnerPanel block.
 * Used for bank balances, marketplace ticker stats, pool stats, etc.
 * (see docs/modal-redesign-plan.md §2.2)
 */
export const StatChip: React.FC<Props> = ({ icon, value, caption, className }) => {
  return (
    <InnerPanel className={classNames("flex items-center gap-2 px-2 py-1.5 min-w-0", className)}>
      {icon && (
        <img
          src={icon || "/placeholder.svg"}
          alt=""
          className="w-6 h-6 object-contain pixelated shrink-0"
        />
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-xs sm:text-sm text-white text-shadow leading-tight truncate">
          {value}
        </span>
        <span className="text-[9px] text-white/60 leading-tight uppercase tracking-wide truncate">
          {caption}
        </span>
      </div>
    </InnerPanel>
  );
};

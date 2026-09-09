import React from "react";
import classNames from "classnames";
import { InnerPanel } from "@/components/ui/Panel";

interface Props {
  /** Item slots (Box components) and optional SectionLabel dividers */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Horizontally scrolling strip of item slots below the showcase —
 * the "Shelf" half of the Showcase + Shelf shop pattern
 * (docs/modal-redesign-plan.md §2.3). Snap-scrolls on mobile.
 */
export const ShopShelf: React.FC<Props> = ({ children, className }) => {
  return (
    <InnerPanel className={classNames("shrink-0", className)}>
      <div
        className="flex flex-nowrap items-center overflow-x-auto snap-x snap-proximity gap-0.5 px-0.5"
        role="listbox"
        aria-label="Shop items"
      >
        {React.Children.map(children, (child) =>
          child == null ? null : (
            <div className="snap-start shrink-0 flex items-center">{child}</div>
          )
        )}
      </div>
    </InnerPanel>
  );
};

import React from "react";
import classNames from "classnames";
import { InnerPanel } from "@/components/ui/Panel";

interface Props {
  /** Item slots (Box components) and optional SectionLabel dividers */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Wrapping grid of item slots — items flow to the next row when they
 * exceed the panel width. Used as the "Shelf" half of the Showcase + Shelf
 * shop pattern (docs/modal-redesign-plan.md §2.3).
 */
export const ShopShelf: React.FC<Props> = ({ children, className }) => {
  return (
    <InnerPanel className={classNames(className)}>
      <div
        className="flex flex-wrap gap-0.5 px-0.5"
        role="listbox"
        aria-label="Shop items"
      >
        {children}
      </div>
    </InnerPanel>
  );
};

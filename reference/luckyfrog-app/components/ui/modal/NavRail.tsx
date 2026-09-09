import React from "react";
import classNames from "classnames";
import { InnerPanel } from "@/components/ui/Panel";

export interface NavRailItem {
  id: string;
  label: string;
  icon?: string;
}

interface Props {
  items: NavRailItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Vertical section switcher — replaces SFL's border-flap top tabs
 * (see docs/modal-redesign-plan.md §2.2).
 * Icon-only on mobile (56px), icon + label from `sm:` up (~140px).
 * Active item renders as an InnerPanel chip; inactive items are flat.
 */
export const NavRail: React.FC<Props> = ({ items, activeId, onSelect, className }) => {
  return (
    <nav
      className={classNames("flex flex-col gap-1 w-14 sm:w-36 shrink-0", className)}
      aria-label="Modal sections"
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        const content = (
          <>
            {item.icon && (
              <img
                src={item.icon || "/placeholder.svg"}
                alt=""
                className="w-6 h-6 object-contain pixelated shrink-0"
              />
            )}
            <span
              className={classNames(
                "text-[9px] uppercase tracking-wide leading-tight truncate",
                item.icon ? "hidden sm:inline" : "inline",
                isActive ? "text-white text-shadow" : "text-white/70"
              )}
              style={{ fontFamily: "var(--font-press-start)" }}
            >
              {item.label}
            </span>
          </>
        );

        if (isActive) {
          return (
            <InnerPanel
              key={item.id}
              className="flex items-center justify-center sm:justify-start gap-2 px-1.5 py-2 cursor-default"
            >
              {content}
            </InnerPanel>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            title={item.label}
            className="flex items-center justify-center sm:justify-start gap-2 px-1.5 py-2 rounded cursor-pointer bg-transparent hover:bg-brown-300/30 hover:brightness-110 transition-all duration-75 border border-transparent"
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
};

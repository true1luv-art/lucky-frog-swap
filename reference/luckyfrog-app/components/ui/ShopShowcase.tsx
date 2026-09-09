import React from "react";
import classNames from "classnames";
import { InnerPanel } from "@/components/ui/Panel";
import { getImageSrc } from "@/features/utils/getImageSrc";

/**
 * Small inline info chip used inside the showcase (price, craft time,
 * ingredient requirements…). Part of the Showcase + Shelf shop pattern
 * (docs/modal-redesign-plan.md §2.3).
 */
export const ShowcaseChip: React.FC<{
  icon?: string;
  danger?: boolean;
  children?: React.ReactNode;
}> = ({ icon, danger, children }) => (
  <span
    className={classNames(
      "inline-flex items-center gap-1 px-1.5 py-1 rounded bg-brown-600/60 border border-brown-600 text-[10px] leading-none text-shadow",
      danger ? "text-red-400" : "text-white"
    )}
  >
    {icon && (
      <img
        src={getImageSrc(icon) || "/placeholder.svg"}
        alt=""
        className="w-4 h-4 object-contain pixelated"
      />
    )}
    {children}
  </span>
);

interface Props {
  image?: string;
  name: string;
  description?: string;
  /** Info chips (price, timers, ingredients) rendered under the description */
  chips?: React.ReactNode;
  /** Extra content (progress bars, lock notices…) below the chips */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Featured-item panel shown at the top of every shop body — the selected
 * item with large art and full details. Replaces the SFL "cramped right
 * detail column" (docs/modal-redesign-plan.md §2.3: feature-first, not
 * browse-first).
 */
export const ShopShowcase: React.FC<Props> = ({
  image,
  name,
  description,
  chips,
  children,
  className,
}) => {
  return (
    <InnerPanel className={classNames("flex items-start gap-3 p-2 shrink-0", className)}>
      <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center rounded bg-brown-600/40 border border-brown-600">
        {image && (
          <img
            src={getImageSrc(image) || "/placeholder.svg"}
            alt={name}
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain pixelated img-highlight"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5 min-w-0 flex-1 py-0.5">
        <h3
          className="text-[10px] sm:text-xs text-white text-shadow uppercase tracking-wide leading-tight text-balance"
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          {name}
        </h3>
        {description && (
          <p className="text-[10px] sm:text-xs text-white/70 leading-relaxed text-pretty">
            {description}
          </p>
        )}
        {chips && <div className="flex items-center gap-1.5 flex-wrap">{chips}</div>}
        {children}
      </div>
    </InnerPanel>
  );
};

"use client";

/**
 * components/marketplace/ListingCard.tsx
 *
 * Compact listing card shown in the marketplace grid. §4.3-E
 *
 * Displays the asset name, seller, price, expiry countdown, and a "View"
 * button that opens the detail modal.
 *
 * Clicking anywhere on the card (or the View button) fires `onSelect`.
 * The parent (MarketplaceGrid) owns the modal open/close state.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.3-E, §4.3-F
 */

import { useEffect, useState } from "react";
import type { ListingView } from "@/shared/marketplace/listing-view";

// ---------------------------------------------------------------------------
// Countdown helper
// ---------------------------------------------------------------------------

function useCountdown(expiresAt: Date | string): string {
  const target = new Date(expiresAt).getTime();

  const calc = () => {
    const diff = target - Date.now();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0)  return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const [display, setDisplay] = useState(calc);

  useEffect(() => {
    const id = setInterval(() => setDisplay(calc), 1_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function assetTypeLabel(assetType: string): string {
  const MAP: Record<string, string> = {
    frog:             "Frog",
    equipment:        "Equipment",
    resource:         "Resource",
    seed:             "Seed",
    food:             "Food",
    fish:             "Fish",
    frogment:         "Frogment",
    crafting_material:"Crafting",
  };
  return MAP[assetType] ?? assetType;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ListingCardProps {
  listing: ListingView;
  onSelect: (listing: ListingView) => void;
  isMine?: boolean;
  onCancel?: (listingId: string) => void;
  cancelling?: boolean;
}

export function ListingCard({ listing, onSelect, isMine, onCancel, cancelling }: ListingCardProps) {
  const countdown = useCountdown(listing.expiresAt);
  const isExpired   = countdown === "Expired";
  const isUnique    = listing.assetType === "equipment"; // Only equipment is unique now (Phase 3)

  return (
    <article
      className={`
        group relative flex flex-col border-2 border-border bg-card transition-all duration-150
        hover:border-primary/60 hover:shadow-[0_2px_0_0_hsl(var(--primary)/0.4)]
        ${isExpired ? "opacity-60" : "cursor-pointer"}
      `}
      onClick={() => !isExpired && onSelect(listing)}
      role="button"
      tabIndex={isExpired ? -1 : 0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); !isExpired && onSelect(listing); } }}
      aria-label={`View listing: ${listing.assetName}`}
    >
      {/* Asset type pill */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="font-pixel text-[7px] uppercase tracking-wide text-muted-foreground">
          {assetTypeLabel(listing.assetType)}
        </span>
      </div>

      {/* Asset name */}
      <div className="px-3 pb-1 pt-1 flex-1">
        <p className="font-pixel text-[9px] leading-relaxed text-foreground text-balance line-clamp-2">
          {listing.assetName}
        </p>
      </div>

      {/* Quantity (stackable only) */}
      {!isUnique && (
        <div className="px-3 pb-1">
          <span className="text-xs text-muted-foreground font-sans">
            Qty: <span className="font-semibold text-foreground">{listing.quantity.toLocaleString()}</span>
          </span>
        </div>
      )}

      {/* Price */}
      <div className="px-3 pb-2">
        <p className="font-pixel text-[10px] text-gold leading-relaxed">
          {fmtPrice(listing.price)}
          <span className="text-[7px] text-muted-foreground ml-1">
            {isUnique ? "LFRG" : "/ unit"}
          </span>
        </p>
        {!isUnique && listing.quantity > 1 && (
          <p className="text-[9px] font-sans text-muted-foreground mt-0.5">
            Total: {fmtPrice(listing.price * listing.quantity)} LFRG
          </p>
        )}
      </div>

      {/* Seller + expiry */}
      <div className="border-t-2 border-border px-3 py-2 flex items-center justify-between gap-2">
        <p className="text-[9px] font-sans text-muted-foreground truncate max-w-[50%]">
          {listing.sellerName}
        </p>
        <p className={`text-[8px] font-pixel ${isExpired ? "text-rose" : "text-muted-foreground"}`}>
          {isExpired ? "Expired" : countdown}
        </p>
      </div>

      {/* Action row */}
      <div className="px-3 pb-3 flex gap-2">
        <button
          type="button"
          className="flex-1 border-2 border-primary bg-primary text-primary-foreground font-pixel text-[8px] uppercase py-1.5 transition-all hover:brightness-110 active:brightness-90 disabled:opacity-50"
          onClick={(e) => { e.stopPropagation(); !isExpired && onSelect(listing); }}
          disabled={isExpired}
        >
          View
        </button>
        {isMine && listing.status === "active" && onCancel && (
          <button
            type="button"
            className="border-2 border-rose/60 bg-rose/10 text-rose font-pixel text-[8px] uppercase px-2 py-1.5 transition-all hover:bg-rose/20 active:bg-rose/30 disabled:opacity-50"
            onClick={(e) => { e.stopPropagation(); onCancel(String(listing._id)); }}
            disabled={cancelling}
          >
            {cancelling ? "..." : "Delist"}
          </button>
        )}
      </div>
    </article>
  );
}

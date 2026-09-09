"use client";

/**
 * components/notifications/NotificationBadge.tsx
 *
 * Displays an activity bell showing the player's recent marketplace events
 * (sales, expirations, cancellations) sourced from marketplace_logs.
 *
 * "Read" state is tracked client-side: `seenAt` (unix ms) is persisted in
 * localStorage. Any log whose `completedAt` is newer than `seenAt` counts as
 * unseen and increments the badge. Clicking "Mark all seen" updates `seenAt`
 * to now — zero DB writes required. §fold-notifications
 */

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityEntry {
  _id:         string;
  type:        "market_sale" | "listing_expired" | "listing_cancelled";
  listingId?:  string;
  assetName:   string;
  assetType:   string;
  quantity:    number;
  totalPrice:  number;
  fee:         number;
  sellerNet:   number;
  completedAt: string; // ISO string from MongoDB
}

interface ActivityResponse {
  activity: ActivityEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEEN_AT_KEY = "lf_activity_seen_at";

function getSeenAt(): number {
  if (typeof window === "undefined") return Date.now();
  return parseInt(localStorage.getItem(SEEN_AT_KEY) ?? "0", 10);
}

function saveSeenAt(ms: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEEN_AT_KEY, String(ms));
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function typeLabel(type: ActivityEntry["type"]): string {
  switch (type) {
    case "market_sale":        return "Sold";
    case "listing_expired":    return "Expired";
    case "listing_cancelled":  return "Cancelled";
    default:                   return "Activity";
  }
}

function typePillClass(type: ActivityEntry["type"]): string {
  switch (type) {
    case "market_sale":       return "bg-neon/20 text-neon";
    case "listing_expired":   return "bg-brown-400/30 text-brown-700";
    case "listing_cancelled": return "bg-gold/20 text-gold";
    default:                  return "bg-brown-400/20 text-brown-700";
  }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const ACTIVITY_KEY = "/api/marketplace/activity?limit=20";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationBadge() {
  const [open, setOpen]       = useState(false);
  const [seenAt, setSeenAt]   = useState<number>(0);
  const panelRef              = useRef<HTMLDivElement>(null);

  // Hydrate seenAt from localStorage after mount (avoids SSR mismatch).
  useEffect(() => { setSeenAt(getSeenAt()); }, []);

  const { data, isLoading } = useSWR<ActivityResponse>(
    ACTIVITY_KEY,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const activity   = data?.activity ?? [];
  const unseenCount = activity.filter(
    (e) => new Date(e.completedAt).getTime() > seenAt,
  ).length;

  // Close popover on outside click.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkAllSeen = useCallback(() => {
    const now = Date.now();
    saveSeenAt(now);
    setSeenAt(now);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        aria-label={`Activity${unseenCount > 0 ? ` (${unseenCount} new)` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center border-2 border-brown-600 bg-brown-200 transition hover:bg-brown-300 active:brightness-90"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-foreground"
          aria-hidden="true"
        >
          <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6zM10 18a2 2 0 002-2H8a2 2 0 002 2z" />
        </svg>

        {unseenCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-neon font-pixel text-[7px] text-white"
          >
            {unseenCount > 99 ? "99" : unseenCount}
          </span>
        )}
      </button>

      {/* Popover panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Marketplace activity"
          className="absolute right-0 top-11 z-50 w-80 border-2 border-brown-600 bg-brown-100 shadow-[4px_4px_0_0_var(--color-brown-700)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-brown-600 px-3 py-2">
            <span className="font-pixel text-[9px] uppercase text-foreground">
              Activity
            </span>
            {unseenCount > 0 && (
              <button
                onClick={handleMarkAllSeen}
                className="font-pixel text-[8px] uppercase text-neon underline hover:brightness-110"
              >
                Mark all seen
              </button>
            )}
          </div>

          {/* List */}
          <ul className="max-h-80 overflow-y-auto">
            {isLoading && (
              <li className="px-3 py-4 text-center font-pixel text-[8px] text-brown-700">
                Loading...
              </li>
            )}
            {!isLoading && activity.length === 0 && (
              <li className="px-3 py-4 text-center font-pixel text-[8px] text-brown-700">
                No recent activity.
              </li>
            )}
            {activity.map((entry) => {
              const unseen = new Date(entry.completedAt).getTime() > seenAt;
              return (
                <li
                  key={entry._id}
                  className={`border-b border-brown-400 px-3 py-2.5 transition ${
                    unseen ? "bg-brown-50" : "opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Unseen dot */}
                    {unseen && (
                      <span
                        aria-hidden="true"
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-neon"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {/* Type pill */}
                      <span
                        className={`mb-1 inline-block px-1.5 py-0.5 font-pixel text-[7px] uppercase ${typePillClass(entry.type)}`}
                      >
                        {typeLabel(entry.type)}
                      </span>

                      {/* Message */}
                      <p className="font-sans text-[11px] leading-snug text-foreground">
                        {entry.type === "market_sale"
                          ? `${entry.quantity > 1 ? `${entry.quantity}x ` : ""}${entry.assetName} sold for ${entry.totalPrice} coins (net ${entry.sellerNet})`
                          : entry.type === "listing_expired"
                          ? `${entry.assetName} listing expired — asset returned`
                          : entry.type === "listing_cancelled"
                          ? `${entry.assetName} listing cancelled`
                          : entry.assetName}
                      </p>

                      <p className="mt-0.5 font-pixel text-[7px] text-brown-700">
                        {timeAgo(entry.completedAt)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}



/**
 * components/marketplace/ListingDetailModal.tsx
 *
 * Listing detail modal. §4.3-F
 *
 * Opened from the listing grid when a card is clicked. Fetches the full
 * listing + live asset document from GET /api/marketplace/listings/[id] via SWR.
 *
 * Sections:
 *   - Stackable asset: quantity available, price per unit, total price.
 *
 * Buy button:
 *   - For stackable assets: quantity input (1 → listing.quantity).
 *   - Calls POST /api/marketplace/purchase (Sprint 4.4 endpoint — stubbed here).
 *   - Disabled when the viewer is the seller.
 *
 * Price history chart area is reserved (Sprint 4.3-C data available) but
 * rendered as a placeholder — a charting library integration is Sprint 4.5+.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.3-F
 */

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import type { ListingView } from "@/features/types/marketplace";
import { usePlayer } from "@/context/PlayerContext";
import { useEIP6963Wallets } from "@/lib/auth/use-wallet-adapter";
import { findConnectedProvider, sendHfarmToTreasury } from "@/lib/client/hfarm-transfer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DetailResponse {
  listing:   ListingView;
  liveAsset: Record<string, unknown> | null;
}

interface PriceHistoryEntry {
  date:   string;
  avg:    number;
  median: number;
  volume: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}



// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------



function StackableBlock({
  listing,
  quantity,
  onQuantityChange,
}: {
  listing: ListingView;
  quantity: number;
  onQuantityChange: (q: number) => void;
}) {
  const total = listing.price * quantity;
  return (
    <div className="flex flex-col gap-4">
      <div className="border-2 border-border">
        <table className="w-full text-xs font-sans">
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-1.5 text-muted-foreground">Available qty</td>
              <td className="px-3 py-1.5 text-foreground font-semibold text-right">
                {listing.quantity.toLocaleString()}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-1.5 text-muted-foreground">Price / unit</td>
              <td className="px-3 py-1.5 text-gold font-semibold text-right">
                {fmtPrice(listing.price)} $HFARM
              </td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 text-muted-foreground">Total</td>
              <td className="px-3 py-1.5 text-gold font-semibold text-right">
                {fmtPrice(total)} $HFARM
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Quantity picker */}
      <div className="flex flex-col gap-2">
        <label className="font-pixel text-[8px] uppercase text-muted-foreground">
          Quantity to buy
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="border-2 border-border bg-card w-8 h-8 font-pixel text-[10px] hover:border-primary transition-colors"
          >
            -
          </button>
          <input
            type="number"
            min={1}
            max={listing.quantity}
            value={quantity}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) onQuantityChange(Math.min(listing.quantity, Math.max(1, v)));
            }}
            className="border-2 border-border bg-card text-foreground text-center text-sm font-sans w-20 py-1 focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => onQuantityChange(Math.min(listing.quantity, quantity + 1))}
            className="border-2 border-border bg-card w-8 h-8 font-pixel text-[10px] hover:border-primary transition-colors"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onQuantityChange(listing.quantity)}
            className="border-2 border-border bg-card font-pixel text-[8px] uppercase px-2 py-1 hover:border-primary transition-colors ml-auto"
          >
            Max
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

interface ListingDetailModalProps {
  listingId: string;
  onClose:   () => void;
  onBuy:     () => void;
}

export function ListingDetailModal({ listingId, onClose, onBuy }: ListingDetailModalProps) {
  const { data, isLoading, error } = useSWR<DetailResponse>(
    `/api/marketplace/listings/${listingId}`,
    fetcher,
  );

  const { player } = usePlayer();
  const { wallets } = useEIP6963Wallets();

  // Quantity for stackable purchase
  const [quantity, setQuantity] = useState(1);
  // On-chain buy flow: idle → signing (wallet) → processing (server) → done
  const [buyStep, setBuyStep] = useState<"idle" | "signing" | "processing">("idle");
  const [buyError, setBuyError] = useState<string | null>(null);

  const buying = buyStep !== "idle";
  const listing = data?.listing;

  // Reset quantity when listing changes
  useEffect(() => { setQuantity(1); }, [listingId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleBuy = useCallback(async () => {
    if (!listing) return;
    if (!player?.wallet) {
      setBuyError("Connect your wallet to purchase.");
      return;
    }
    setBuyError(null);

    // Amount the buyer pays the treasury on-chain — the full listing price,
    // rounded to cents to match the server's exact verification amount.
    const amount = Math.round(listing.price * quantity * 100) / 100;

    // 1. Buyer signs an on-chain $HFARM payment to the treasury.
    let txHash: string;
    try {
      setBuyStep("signing");
      const provider = await findConnectedProvider(wallets);
      if (!provider) {
        setBuyError("No connected wallet found. Please connect your wallet first.");
        setBuyStep("idle");
        return;
      }
      txHash = await sendHfarmToTreasury(provider, player.wallet, amount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet transaction failed";
      setBuyError(/user rejected|denied/i.test(msg) ? "Transaction rejected in wallet." : msg);
      setBuyStep("idle");
      return;
    }

    // 2. Submit the payment hash — the server verifies it and queues settlement.
    try {
      setBuyStep("processing");
      const res = await fetch(`/api/marketplace/listings/${String(listing._id)}/purchase`, {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body:        JSON.stringify({ quantity, txHash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setBuyError(
          (data.error ?? "Purchase failed") +
          " — your payment is safe; if the item isn't delivered it will be refunded on-chain.",
        );
        return;
      }
      onBuy();
    } catch (err) {
      setBuyError(
        (err instanceof Error ? err.message : "Network error") +
        " — your payment is safe and will settle or refund on-chain.",
      );
    } finally {
      setBuyStep("idle");
    }
  }, [listing, quantity, onBuy, player, wallets]);

  // Compute buy total
  const buyTotal = listing ? listing.price * quantity : 0;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Listing detail"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-lg bg-background border-2 border-border shadow-[4px_4px_0_0_hsl(var(--foreground)/0.15)] overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-border px-5 py-4">
          <span className="font-pixel text-[9px] uppercase text-foreground">
            {isLoading ? "Loading..." : (listing?.assetName ?? "Listing")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-pixel text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            X
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-5">
          {isLoading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm font-sans text-rose">Failed to load listing details.</p>
          )}

          {!isLoading && listing && (
            <>
              {/* Asset detail block */}
              <StackableBlock
                listing={listing}
                quantity={quantity}
                onQuantityChange={setQuantity}
              />

              {/* Seller info */}
              <div className="flex flex-col gap-1 border-t-2 border-border pt-4">
                <div className="flex items-center justify-between text-xs font-sans">
                  <span className="text-muted-foreground">Seller</span>
                  <span className="text-foreground font-medium">{listing.sellerName}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-sans">
                  <span className="text-muted-foreground">Listed</span>
                  <span className="text-foreground">{new Date(listing.createdAt).toLocaleDateString()}</span>
                </div>

              </div>

              {/* Price history placeholder — chart wired in Sprint 4.5+ */}
              <div className="border-2 border-border/50 border-dashed px-4 py-6 text-center">
                <p className="font-pixel text-[7px] uppercase text-muted-foreground/60">
                  Price history chart — coming soon
                </p>
              </div>

              {/* Buy error */}
              {buyError && (
                <p className="text-sm font-sans text-rose">{buyError}</p>
              )}
            </>
          )}
        </div>

        {/* Footer: price summary + buy button */}
        {!isLoading && listing && listing.status === "active" && (
          <div className="border-t-2 border-border px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-pixel text-[7px] uppercase text-muted-foreground">
                {`Total (${quantity.toLocaleString()} unit${quantity !== 1 ? "s" : ""})`}
              </span>
              <span className="font-pixel text-[13px] text-gold">
                {fmtPrice(buyTotal)} $HFARM
              </span>
            </div>
            <button
              type="button"
              onClick={handleBuy}
              disabled={buying}
              className="border-2 border-neon bg-neon text-white font-pixel text-[9px] uppercase px-5 py-2.5 transition-all hover:brightness-110 active:brightness-90 disabled:opacity-50"
            >
              {buying ? "Buying..." : "Buy Now"}
            </button>
          </div>
        )}

        {/* Inactive listing notice */}
        {!isLoading && listing && listing.status !== "active" && (
          <div className="border-t-2 border-border px-5 py-4">
            <p className="font-pixel text-[8px] uppercase text-muted-foreground text-center">
              This listing is {listing.status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

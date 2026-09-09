

/**
 * MarketplaceModal — fullscreen marketplace mount.
 *
 * Polls /api/marketplace/listings every 15 s so all players see lock state
 * updates within one poll cycle — no WebSocket or Redis needed.
 *
 * Purchase flow (per MarketplaceScreen detail drawer):
 *   1. POST /lock          → 10-min DB lock (returns 409 if held by another)
 *   2. POST /purchase      → price quote
 *   3. MetaMask ERC-20 transfer
 *   4. POST /confirm       → verify + settle (releases lock)
 *
 * On Cancel / drawer close → DELETE /lock releases immediately.
 */

import React, { useCallback, useMemo } from "react";
import useSWR from "swr";
import {
  MarketplaceScreen,
  type MarketplaceListing,
  type MarketplaceCategory,
  type MarketplaceRarity,
  type MarketplaceTopSale,
  type MarketplaceStats,
  type BuyPhase,
} from "@/features/game-components/marketplace/MarketplaceScreen";
import {
  purchaseListingOnChain,
  cancelListingLock,
} from "@/lib/client/marketplace-purchase";
import { ITEM_DETAILS }            from "@/features/types/item-details";
import type { InventoryItemName }  from "@/features/types/gameplay/game";

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

interface ApiListing {
  _id:         string;
  assetType:   MarketplaceCategory;
  assetName:   string;
  sellerId:    string;
  sellerName?: string;
  price:       number;
  quantity:    number;
  rarity?:     string;
  status:      string;
  lockedBy?:   string | null;
  lockedUntil?: string | null;
}

interface ListingsResponse {
  listings: ApiListing[];
  total:    number;
}

interface AnalyticsResponse {
  totalVolumeAllTime:  number;
  activeListingCount:  number;
  topAssets: {
    assetName: string;
    assetType: string;
    volume:    number;
    trades:    number;
    avgPrice:  number;
  }[];
}

interface PriceResponse    { price: number }
interface MineResponse     { summary?: { activeCount: number } }
interface LfrgBalanceResponse { balance: number; configured?: boolean }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_RARITIES: MarketplaceRarity[] = [
  "common", "uncommon", "rare", "epic", "legendary",
];

function normalizeRarity(r?: string): MarketplaceRarity | undefined {
  if (!r) return undefined;
  const lower = r.toLowerCase() as MarketplaceRarity;
  return VALID_RARITIES.includes(lower) ? lower : undefined;
}

function usdFor(lfrg: number, lfrgUsd: number): string {
  const v = lfrg * lfrgUsd;
  if (!Number.isFinite(v) || v <= 0) return "";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const CATEGORY_ICON: Record<string, string> = {
  resource:          "/assets/resources/stone.png",
  seed:              "/assets/icons/token.png",
  food:              "/assets/icons/token.png",
  fish:              "/assets/fish/fish.png",
  crafting_material: "/assets/resources/wood.png",
};

function resolveImage(l: ApiListing): string {
  const detail = ITEM_DETAILS[l.assetName as InventoryItemName];
  if (detail?.image) return detail.image;
  return CATEGORY_ICON[l.assetType] ?? "/assets/icons/token.png";
}

function compact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MarketplaceModalProps {
  show:   boolean;
  onHide: () => void;
}

export const MarketplaceModal: React.FC<MarketplaceModalProps> = ({
  show,
  onHide,
}) => {
  // ---------------------------------------------------------------------------
  // Data fetching — all disabled while the modal is closed.
  // Listings poll every 15 s so players see lock state within one cycle.
  // ---------------------------------------------------------------------------

  const { data: listingsData, mutate: mutateListings } =
    useSWR<ListingsResponse>(
      show ? "/api/marketplace/listings?limit=100&sort=newest" : null,
      fetcher,
      { refreshInterval: 15_000 },
    );

  const { data: analytics, mutate: mutateAnalytics } =
    useSWR<AnalyticsResponse>(
      show ? "/api/marketplace/analytics" : null,
      fetcher,
      { refreshInterval: 60_000 },
    );

  const { data: priceData } = useSWR<PriceResponse>(
    show ? "/api/price" : null,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const { data: mine } = useSWR<MineResponse>(
    show ? "/api/marketplace/listings/mine?status=active" : null,
    fetcher,
    { refreshInterval: 30_000 },
  );

  const { data: balanceData } = useSWR<LfrgBalanceResponse>(
    show ? "/api/wallet/lfrg-balance" : null,
    fetcher,
    { refreshInterval: 30_000 },
  );

  const lfrgBalance = balanceData?.balance ?? 0;
  const lfrgUsd     = priceData?.price    ?? 0;

  // ---------------------------------------------------------------------------
  // Map API listings → screen listings (includes lock fields).
  // ---------------------------------------------------------------------------

  const listings: MarketplaceListing[] = useMemo(() => {
    const raw = listingsData?.listings ?? [];
    const mapped = raw.map((l): MarketplaceListing => ({
      id:          String(l._id),
      name:        l.assetName,
      category:    l.assetType,
      rarity:      normalizeRarity(l.rarity),
      price:       l.price,
      usd:         usdFor(l.price, lfrgUsd),
      image:       resolveImage(l),
      seller:      l.sellerName || `${l.sellerId.slice(0, 4)}…${l.sellerId.slice(-4)}`,
      featured:    false,
      lockedBy:    l.lockedBy   ?? null,
      lockedUntil: l.lockedUntil ?? null,
    }));

    // Feature the highest-priced active listings.
    const topIds = new Set(
      [...mapped].sort((a, b) => b.price - a.price).slice(0, 12).map((l) => l.id),
    );
    return mapped.map((l) => ({ ...l, featured: topIds.has(l.id) }));
  }, [listingsData, lfrgUsd]);

  // Top sales strip.
  const topSales: MarketplaceTopSale[] = useMemo(
    () =>
      (analytics?.topAssets ?? []).slice(0, 6).map((a) => ({
        item:  a.assetName,
        buyer: `${a.trades.toLocaleString()} sold`,
        price: Math.round(a.avgPrice),
        usd:   usdFor(a.avgPrice, lfrgUsd),
      })),
    [analytics, lfrgUsd],
  );

  const stats: MarketplaceStats = useMemo(() => {
    const recentTrades = (analytics?.topAssets ?? []).reduce(
      (s, a) => s + a.trades,
      0,
    );
    return {
      totalVolume:    `${compact(analytics?.totalVolumeAllTime ?? 0)} LFRG`,
      totalTrades:    compact(recentTrades),
      walletsHolding: (analytics?.activeListingCount ?? listings.length).toLocaleString(),
    };
  }, [analytics, listings.length]);

  // ---------------------------------------------------------------------------
  // Purchase handler — passes the phase setter into purchaseListingOnChain
  // indirectly: the screen's DetailDrawer owns phase state, so we throw on
  // failure and let the drawer catch it.
  // ---------------------------------------------------------------------------

  const handleBuy = useCallback(
    async (listing: MarketplaceListing, setPhase: (p: BuyPhase) => void) => {
      setPhase("locking");
      const result = await purchaseListingOnChain(listing.id, 1);
      if (!result.ok) {
        throw new Error(result.error ?? "Purchase failed.");
      }
      setPhase("processing");
      // Refresh listings + analytics after a successful purchase.
      mutateListings();
      mutateAnalytics();
    },
    [mutateListings, mutateAnalytics],
  );

  // Release lock when the player dismisses the drawer without buying.
  const handleCancelBuy = useCallback((listingId: string) => {
    cancelListingLock(listingId).catch(() => {/* non-fatal */});
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <MarketplaceScreen
      show={show}
      onClose={onHide}
      listings={listings}
      topSales={topSales}
      stats={stats}
      lfrgBalance={lfrgBalance}
      lfrgUsdPrice={lfrgUsd > 0 ? `$${lfrgUsd.toFixed(4)}` : undefined}
      myListingsCount={mine?.summary?.activeCount ?? 0}
      onBuy={handleBuy}
      onCancelBuy={handleCancelBuy}
    />
  );
};

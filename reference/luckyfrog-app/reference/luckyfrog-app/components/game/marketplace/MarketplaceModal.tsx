"use client";

/**
 * MarketplaceModal — fullscreen marketplace mount
 * (docs/modal-redesign-plan.md §2.4, Phase C).
 *
 * Thin wrapper over MarketplaceScreen. This is the LIVE marketplace — it reads
 * real listings, analytics, $LFRG price and the player's balance from the API /
 * game store, and settles purchases on-chain via purchaseListingOnChain. The
 * layout itself is shared with the /test-modals mock shell.
 */

import React, { useCallback, useMemo } from "react";
import useSWR from "swr";
import Decimal from "decimal.js-light";
import {
  MarketplaceScreen,
  type MarketplaceListing,
  type MarketplaceCategory,
  type MarketplaceRarity,
  type MarketplaceTopSale,
  type MarketplaceStats,
} from "@/components/game/marketplace/MarketplaceScreen";
import { purchaseListingOnChain } from "@/lib/client/marketplace-purchase";
import { ITEM_DETAILS } from "@/shared/types/gameplay/images";
import type { InventoryItemName } from "@/shared/types/gameplay/game";
import { useGameStore } from "@/lib/stores/game/useGameStore";

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

interface ApiListing {
  _id: string;
  assetType: MarketplaceCategory;
  assetName: string;
  sellerId: string;
  sellerName?: string;
  price: number;
  quantity: number;
  rarity?: string;
  status: string;
}

interface ListingsResponse {
  listings: ApiListing[];
  total: number;
}

interface AnalyticsResponse {
  totalVolumeAllTime: number;
  activeListingCount: number;
  topAssets: { assetName: string; assetType: string; volume: number; trades: number; avgPrice: number }[];
}

interface PriceResponse {
  price: number;
}

interface MineResponse {
  summary?: { activeCount: number };
}

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_RARITIES: MarketplaceRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

const CATEGORY_ICON: Record<string, string> = {
  frog: "/assets/buildings/market_building.png",
  equipment: "/assets/icons/player.png",
  resource: "/assets/resources/stone.png",
  seed: "/assets/icons/luckyfrog_token.png",
  food: "/assets/icons/luckyfrog_token.png",
  frogment: "/assets/icons/luckyfrog_token.png",
  fish: "/assets/fish/fish.png",
  crafting_material: "/assets/resources/wood.png",
};

function normalizeRarity(r?: string): MarketplaceRarity {
  const lower = (r ?? "").toLowerCase() as MarketplaceRarity;
  return VALID_RARITIES.includes(lower) ? lower : "common";
}

function resolveImage(l: ApiListing): string {
  const detail = ITEM_DETAILS[l.assetName as InventoryItemName];
  if (detail?.image) return detail.image;
  return CATEGORY_ICON[l.assetType] ?? "/assets/icons/luckyfrog_token.png";
}

function compact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function usdFor(lfrg: number, lfrgUsd: number): string {
  const v = lfrg * lfrgUsd;
  if (!Number.isFinite(v) || v <= 0) return "$0.00";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MarketplaceModalProps {
  show: boolean;
  onHide: () => void;
}

export const MarketplaceModal: React.FC<MarketplaceModalProps> = ({ show, onHide }) => {
  // Only fetch while the modal is open.
  const { data: listingsData, mutate: mutateListings } = useSWR<ListingsResponse>(
    show ? "/api/marketplace/listings?limit=100&sort=newest" : null,
    fetcher,
  );
  const { data: analytics, mutate: mutateAnalytics } = useSWR<AnalyticsResponse>(
    show ? "/api/marketplace/analytics" : null,
    fetcher,
  );
  const { data: priceData } = useSWR<PriceResponse>(show ? "/api/price" : null, fetcher, {
    refreshInterval: 60_000,
  });
  const { data: mine } = useSWR<MineResponse>(
    show ? "/api/marketplace/listings/mine?status=active" : null,
    fetcher,
  );

  const balanceRaw = useGameStore((s) => s.state.balance);
  const lfrgBalance = useMemo(() => {
    try {
      return new Decimal(balanceRaw ?? 0).toNumber();
    } catch {
      return 0;
    }
  }, [balanceRaw]);

  const lfrgUsd = priceData?.price ?? 0;

  // Map API listings → screen listings.
  const listings: MarketplaceListing[] = useMemo(() => {
    const raw = listingsData?.listings ?? [];
    const mapped = raw.map((l) => ({
      id: String(l._id),
      name: l.assetName,
      category: l.assetType,
      rarity: normalizeRarity(l.rarity),
      price: l.price,
      usd: usdFor(l.price, lfrgUsd),
      image: resolveImage(l),
      seller: l.sellerName || `${l.sellerId.slice(0, 4)}…${l.sellerId.slice(-4)}`,
      featured: false,
    }));

    // Feature the highest-priced active listings so the Featured tab is populated.
    const topIds = new Set(
      [...mapped].sort((a, b) => b.price - a.price).slice(0, 12).map((l) => l.id),
    );
    return mapped.map((l) => ({ ...l, featured: topIds.has(l.id) }));
  }, [listingsData, lfrgUsd]);

  // Top sales strip — derived from 30-day analytics top assets (real data).
  const topSales: MarketplaceTopSale[] = useMemo(() => {
    return (analytics?.topAssets ?? []).slice(0, 6).map((a) => ({
      item: a.assetName,
      buyer: `${a.trades.toLocaleString()} sold`,
      price: Math.round(a.avgPrice),
      usd: usdFor(a.avgPrice, lfrgUsd),
    }));
  }, [analytics, lfrgUsd]);

  const stats: MarketplaceStats = useMemo(() => {
    const recentTrades = (analytics?.topAssets ?? []).reduce((sum, a) => sum + a.trades, 0);
    return {
      totalVolume: `${compact(analytics?.totalVolumeAllTime ?? 0)} LFRG`,
      totalTrades: compact(recentTrades),
      walletsHolding: (analytics?.activeListingCount ?? listings.length).toLocaleString(),
    };
  }, [analytics, listings.length]);

  const handleBuy = useCallback(
    async (listing: MarketplaceListing) => {
      const result = await purchaseListingOnChain(listing.id, 1);
      if (!result.ok) {
        window.alert(result.error ?? "Purchase failed");
        return;
      }
      // Refresh the market view after a successful settlement.
      mutateListings();
      mutateAnalytics();
    },
    [mutateListings, mutateAnalytics],
  );

  return (
    <MarketplaceScreen
      show={show}
      onClose={onHide}
      listings={listings}
      topSales={topSales}
      stats={stats}
      lfrgBalance={lfrgBalance}
      lfrgUsdPrice={lfrgUsd > 0 ? `$${lfrgUsd.toFixed(4)}` : "—"}
      myListingsCount={mine?.summary?.activeCount ?? 0}
      onBuy={handleBuy}
    />
  );
};

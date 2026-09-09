"use client";

/**
 * app/test-modals/stubs/MarketplaceMockShell.tsx
 *
 * Test harness for the fullscreen Marketplace
 * (docs/modal-redesign-plan.md §2.4, Phase C).
 *
 * Renders the shared MarketplaceScreen layout fed entirely with mock data:
 *  - MOCK_MARKETPLACE_LISTINGS → card grid
 *  - MOCK_WHALE_TRADERS        → reshaped into the "Top Sales" strip
 *  - MOCK_MARKETPLACE_STATS    → ticker footer
 */

import React from "react";
import {
  MarketplaceScreen,
  type MarketplaceTopSale,
} from "@/components/game/marketplace/MarketplaceScreen";
import {
  MOCK_MARKETPLACE_LISTINGS,
  MOCK_WHALE_TRADERS,
  MOCK_MARKETPLACE_STATS,
  MOCK_WALLET_BALANCE,
} from "@/app/test-modals/mockup-data";

// Reshape whale-trader rows into Top Sales cards (plan §2.4 / Phase C step 2)
const TOP_SALES: MarketplaceTopSale[] = MOCK_WHALE_TRADERS.map((t) => ({
  item: t.item,
  buyer: t.buyer,
  price: t.price,
  usd: t.usd,
}));

interface MarketplaceMockShellProps {
  open: boolean;
  onClose: () => void;
}

export function MarketplaceMockShell({ open, onClose }: MarketplaceMockShellProps) {
  return (
    <MarketplaceScreen
      show={open}
      onClose={onClose}
      listings={MOCK_MARKETPLACE_LISTINGS}
      topSales={TOP_SALES}
      stats={MOCK_MARKETPLACE_STATS}
      lfrgBalance={MOCK_WALLET_BALANCE.lfrg}
      lfrgUsdPrice={`$${MOCK_WALLET_BALANCE.lfrgUsd}`}
      myListingsCount={2}
      badge={
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-800/60 text-yellow-300 border border-yellow-700/40">
          MOCK DATA
        </span>
      }
      onBuy={(listing) => {
        console.log("[v0] mock buy:", listing.name);
      }}
    />
  );
}

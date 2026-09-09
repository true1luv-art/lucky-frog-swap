"use client";

/**
 * MarketplaceScreen — fullscreen marketplace layout
 * (docs/modal-redesign-plan.md §2.4).
 *
 * ┌ 100vw × 100dvh OuterPanel ────────────────────────────┐
 * │ TitleBar: [icon] MARKETPLACE      [LFRG chip] [✕]     │
 * │ CommandBar: [search…] [sort ▾] [rarity ▾]             │
 * │ CategoryRail: (Featured)(Frogs)(Items)(Resources)…    │
 * │ Content: responsive card grid (only this scrolls)     │
 * │   + detail drawer (right on sm:+, bottom sheet on xs) │
 * │ TickerBar: LFRG price · volume · trades · my listings │
 * └───────────────────────────────────────────────────────┘
 *
 * Purely presentational — listings / top sales / stats come in as props
 * so the live modal and the /test-modals mock shell share one layout.
 */

import React, { useMemo, useState } from "react";
import { InnerPanel, OuterPanel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import {
  ModalShell,
  ModalTitleBar,
  ActionDock,
  SectionLabel,
} from "@/components/ui/modal";

const token = "/assets/icons/luckyfrog_token.png";
const marketBuilding = "/assets/buildings/market_building.png";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// §C6 — categories mirror the Phase 4 TRADABLE_ASSET_TYPES (lib/config/marketplace.ts)
export type MarketplaceCategory =
  | "frog"
  | "equipment"
  | "resource"
  | "seed"
  | "food"
  | "frogment"
  | "fish"
  | "crafting_material";

export type MarketplaceRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export interface MarketplaceListing {
  id: string;
  name: string;
  category: MarketplaceCategory;
  rarity: MarketplaceRarity;
  /** Price in LFRG */
  price: number;
  usd: string;
  image: string;
  seller: string;
  featured?: boolean;
}

export interface MarketplaceTopSale {
  item: string;
  buyer: string;
  price: number;
  usd: string;
}

export interface MarketplaceStats {
  totalVolume: string;
  totalTrades: string;
  walletsHolding: string;
}

interface Props {
  show: boolean;
  onClose: () => void;
  listings: MarketplaceListing[];
  topSales: MarketplaceTopSale[];
  stats: MarketplaceStats;
  lfrgBalance: number;
  lfrgUsdPrice: string;
  myListingsCount: number;
  /** Small badge next to the balance chip (e.g. "MOCK DATA" on /test-modals) */
  badge?: React.ReactNode;
  onBuy?: (listing: MarketplaceListing) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type RailCategory = "featured" | MarketplaceCategory;

const CATEGORIES: { id: RailCategory; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "frog", label: "Frogs" },
  { id: "equipment", label: "Equipment" },
  { id: "resource", label: "Resources" },
  { id: "seed", label: "Seeds" },
  { id: "food", label: "Food" },
  { id: "frogment", label: "Frogments" },
  { id: "fish", label: "Fish" },
  { id: "crafting_material", label: "Materials" },
];

const RARITY_STRIPE: Record<MarketplaceRarity, string> = {
  common: "#9aa0a6",
  uncommon: "#7ec850",
  rare: "#4f9cf9",
  epic: "#b06ef3",
  legendary: "#f2b135",
};

const RARITY_TEXT: Record<MarketplaceRarity, string> = {
  common: "text-white/70",
  uncommon: "text-[#7ec850]",
  rare: "text-[#4f9cf9]",
  epic: "text-[#b06ef3]",
  legendary: "text-[#f2b135]",
};

type SortKey = "recent" | "price-asc" | "price-desc" | "name";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "price-asc", label: "Price ↑" },
  { id: "price-desc", label: "Price ↓" },
  { id: "name", label: "Name A–Z" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ListingCard({
  listing,
  selected,
  onClick,
}: {
  listing: MarketplaceListing;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left transition-all duration-75 cursor-pointer ${
        selected ? "brightness-110 -translate-y-0.5" : "hover:brightness-110"
      }`}
      aria-pressed={selected}
    >
      <InnerPanel className="flex flex-col gap-1 p-1.5 h-full">
        {/* rarity stripe */}
        <div
          className="h-1 rounded-full w-full"
          style={{ background: RARITY_STRIPE[listing.rarity] }}
          aria-hidden="true"
        />
        <div className="flex items-center justify-center h-16 sm:h-20">
          <img
            src={listing.image || "/placeholder.svg"}
            alt={listing.name}
            className="max-h-full max-w-full object-contain pixelated"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>
        <p className="text-white text-shadow text-[10px] leading-tight truncate">
          {listing.name}
        </p>
        <p className={`text-[9px] leading-tight capitalize ${RARITY_TEXT[listing.rarity]}`}>
          {listing.rarity}
        </p>
        <div className="flex items-center gap-1 mt-auto">
          <img src={token || "/placeholder.svg"} alt="LFRG" className="w-3.5 h-3.5 pixelated" />
          <span className="text-white text-shadow text-[10px] font-semibold truncate">
            {listing.price.toLocaleString()}
          </span>
        </div>
      </InnerPanel>
    </button>
  );
}

function TopSaleCard({ sale }: { sale: MarketplaceTopSale }) {
  return (
    <InnerPanel className="flex items-center gap-2 px-2 py-1.5 shrink-0 w-56">
      <img src={token || "/placeholder.svg"} alt="" className="w-5 h-5 pixelated shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-white text-shadow text-[10px] leading-tight truncate">{sale.item}</p>
        <p className="text-white/50 text-[9px] leading-tight truncate">by {sale.buyer}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-white text-shadow text-[10px] font-semibold leading-tight">
          {sale.price.toLocaleString()}
        </p>
        <p className="text-white/50 text-[9px] leading-tight">{sale.usd}</p>
      </div>
    </InnerPanel>
  );
}

function TickerItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5 shrink-0">
      <span className="text-[9px] text-white/50 uppercase tracking-wide">{label}</span>
      <span className="text-[10px] text-white text-shadow font-semibold">{value}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const MarketplaceScreen: React.FC<Props> = ({
  show,
  onClose,
  listings,
  topSales,
  stats,
  lfrgBalance,
  lfrgUsdPrice,
  myListingsCount,
  badge,
  onBuy,
}) => {
  const [category, setCategory] = useState<RailCategory>("featured");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [rarityFilter, setRarityFilter] = useState<"all" | MarketplaceRarity>("all");
  const [selected, setSelected] = useState<MarketplaceListing | null>(null);

  const visible = useMemo(() => {
    let list =
      category === "featured"
        ? listings.filter((l) => l.featured)
        : listings.filter((l) => l.category === category);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q));
    }
    if (rarityFilter !== "all") {
      list = list.filter((l) => l.rarity === rarityFilter);
    }

    switch (sort) {
      case "price-asc":
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case "name":
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }
    return list;
  }, [listings, category, search, sort, rarityFilter]);

  const selectStyles =
    "bg-brown-600/60 border border-brown-600 rounded text-white text-[10px] px-1.5 py-1 outline-none cursor-pointer";

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="fullscreen"
      titleBar={
        <ModalTitleBar
          icon={marketBuilding}
          title="Marketplace"
          subtitle="Buy, swap, sell!"
          onClose={onClose}
          extra={
            <>
              {badge}
              <span className="flex items-center gap-1 rounded bg-brown-600/60 border border-brown-600 px-2 py-1">
                <img src={token || "/placeholder.svg"} alt="LFRG" className="w-4 h-4 pixelated" />
                <span className="text-white text-shadow text-[10px]">
                  {lfrgBalance.toLocaleString()}
                </span>
              </span>
            </>
          }
        />
      }
      actionDock={
        <InnerPanel className="flex items-center gap-4 px-2 py-1.5 overflow-x-auto shrink-0">
          <span className="flex items-center gap-1 shrink-0">
            <img src={token || "/placeholder.svg"} alt="LFRG" className="w-4 h-4 pixelated" />
            <span className="text-[10px] text-white text-shadow font-semibold">
              {lfrgUsdPrice}
            </span>
            <span className="text-[9px] text-white/50">/ LFRG</span>
          </span>
          <TickerItem label="Volume" value={stats.totalVolume} />
          <TickerItem label="Trades" value={stats.totalTrades} />
          <TickerItem label="Listings" value={stats.walletsHolding} />
          <TickerItem label="My listings" value={String(myListingsCount)} />
        </InnerPanel>
      }
    >
      {/* CommandBar */}
      <InnerPanel className="flex flex-wrap items-center gap-2 px-2 py-1.5 shrink-0">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings..."
          aria-label="Search listings"
          className="flex-1 min-w-32 bg-brown-600/60 border border-brown-600 rounded text-white text-[10px] placeholder-white/40 px-2 py-1 outline-none focus:border-yellow-700"
        />
        <label className="sr-only" htmlFor="marketplace-sort">
          Sort listings
        </label>
        <select
          id="marketplace-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className={selectStyles}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="marketplace-rarity">
          Filter by rarity
        </label>
        <select
          id="marketplace-rarity"
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value as "all" | MarketplaceRarity)}
          className={selectStyles}
        >
          <option value="all">All rarities</option>
          {(Object.keys(RARITY_STRIPE) as MarketplaceRarity[]).map((r) => (
            <option key={r} value={r} className="capitalize">
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </InnerPanel>

      {/* CategoryRail — horizontal chip row */}
      <div
        className="flex gap-1.5 overflow-x-auto shrink-0 px-0.5 py-0.5"
        role="tablist"
        aria-label="Marketplace categories"
      >
        {CATEGORIES.map((c) => {
          const isActive = c.id === category;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setCategory(c.id);
                setSelected(null);
              }}
              className={`shrink-0 px-2.5 py-1.5 rounded text-[9px] uppercase tracking-wide transition-all duration-75 cursor-pointer border ${
                isActive
                  ? "bg-[#3a2410] text-yellow-400 border-yellow-900"
                  : "bg-transparent text-white/60 border-transparent hover:bg-brown-300/30 hover:text-white"
              }`}
              style={{ fontFamily: "var(--font-press-start)" }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Content area — only this scrolls */}
      <div className="relative flex-1 min-h-0">
        <div className="h-full overflow-y-auto flex flex-col gap-2 pb-1">
          {/* Top Sales strip — Featured only */}
          {category === "featured" && topSales.length > 0 && (
            <section aria-label="Top sales">
              <SectionLabel className="mb-1.5">Top Sales · 7 days</SectionLabel>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {topSales.map((sale, i) => (
                  <TopSaleCard key={i} sale={sale} />
                ))}
              </div>
            </section>
          )}

          {category === "featured" && (
            <SectionLabel className="self-start">Featured listings</SectionLabel>
          )}

          {visible.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-white/50 text-[10px] text-shadow">
                No listings match your filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
              {visible.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  selected={selected?.id === listing.id}
                  onClick={() => setSelected(listing)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail drawer — right panel on sm:+, bottom sheet on mobile */}
        {selected && (
          <div className="absolute z-10 inset-x-0 bottom-0 h-[75%] sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-auto sm:w-72 flex flex-col justify-end sm:justify-start">
            <OuterPanel className="flex flex-col gap-1 max-h-full sm:h-full overflow-hidden">
              <InnerPanel className="flex items-center justify-between gap-2 px-2 py-1 shrink-0">
                <span
                  className="text-[9px] text-white text-shadow uppercase tracking-wide truncate"
                  style={{ fontFamily: "var(--font-press-start)" }}
                >
                  Listing
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close listing details"
                  className="w-6 h-6 flex items-center justify-center rounded bg-brown-600/60 border border-brown-600 hover:brightness-125 cursor-pointer"
                >
                  <img
                    src="/assets/icons/close.png"
                    alt=""
                    className="w-3 h-3 pixelated"
                  />
                </button>
              </InnerPanel>

              <InnerPanel className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-2 p-3">
                <div
                  className="w-24 h-24 flex items-center justify-center rounded"
                  style={{
                    background: `radial-gradient(circle, ${RARITY_STRIPE[selected.rarity]}33 0%, transparent 70%)`,
                  }}
                >
                  <img
                    src={selected.image || "/placeholder.svg"}
                    alt={selected.name}
                    className="max-h-20 max-w-20 object-contain pixelated"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                </div>
                <p className="text-white text-shadow text-xs text-center text-balance">
                  {selected.name}
                </p>
                <p className={`text-[10px] capitalize ${RARITY_TEXT[selected.rarity]}`}>
                  {selected.rarity}
                </p>
                <div className="flex items-center gap-1.5">
                  <img src={token || "/placeholder.svg"} alt="LFRG" className="w-4 h-4 pixelated" />
                  <span className="text-white text-shadow text-sm font-semibold">
                    {selected.price.toLocaleString()}
                  </span>
                  <span className="text-white/50 text-[10px]">{selected.usd}</span>
                </div>
                <p className="text-white/50 text-[9px]">Seller: {selected.seller}</p>
              </InnerPanel>

              <ActionDock
                info={
                  <span className="truncate">
                    Balance: {lfrgBalance.toLocaleString()} LFRG
                  </span>
                }
              >
                <Button
                  className="text-xs px-3 w-auto"
                  disabled={lfrgBalance < selected.price}
                  onClick={() => {
                    onBuy?.(selected);
                    setSelected(null);
                  }}
                >
                  Buy
                </Button>
              </ActionDock>
            </OuterPanel>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

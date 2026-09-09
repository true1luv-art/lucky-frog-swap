'use client';

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useGameStore, type RosterHero } from "@/features/store/gameStore";
import { HeroSprite } from "@/features/game-components/heroes/HeroSprite";

/* ---------- design tokens ---------- */
const PIXEL_HEAD = "'Press Start 2P', 'Silkscreen', monospace";
const PIXEL_BODY = "'VT323', 'Silkscreen', monospace";
const GOLD = "#facc15";
const CREAM = "#f5e9c4";
const INK = "#0a0a0a";
const PANEL = "#141422";
const SUB = "#8b8b9e";
const LINE = "#26263a";

type RarityKey = "common" | "uncommon" | "rare" | "epic" | "legendary";
type SortKey = "latest" | "price_asc" | "price_desc" | "stats" | "rarity";

const RARITY_ORDER: RarityKey[] = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_META: Record<RarityKey, { label: string; color: string; glow: string }> = {
  common:    { label: "Common",    color: "#9ca3af", glow: "rgba(156,163,175,0.18)" },
  uncommon:  { label: "Uncommon",  color: "#22c55e", glow: "rgba(34,197,94,0.24)" },
  rare:      { label: "Rare",      color: "#3b82f6", glow: "rgba(59,130,246,0.28)" },
  epic:      { label: "Epic",      color: "#a855f7", glow: "rgba(168,85,247,0.32)" },
  legendary: { label: "Legendary", color: "#facc15", glow: "rgba(250,204,21,0.4)" },
};

function statTotal(h: RosterHero): number {
  const a = h.attributes;
  return a.power + a.speed + a.stamina + a.bomb_number + a.bomb_range;
}
function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/* ============================================================ */

export default function MarketplacePage() {
  const coins = useGameStore((s) => s.coins);
  const listings = useGameStore((s) => s.marketListings);
  const buyListing = useGameStore((s) => s.buyListing);

  const [rarityFilter, setRarityFilter] = useState<Set<RarityKey>>(new Set());
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [minPower, setMinPower] = useState(0);
  const [minSpeed, setMinSpeed] = useState(0);
  const [minStamina, setMinStamina] = useState(0);
  const [sort, setSort] = useState<SortKey>("latest");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const min = Number(priceMin) || 0;
    const max = Number(priceMax) || Infinity;
    const q = query.trim().toLowerCase();
    let arr = listings.filter((l) => {
      if (rarityFilter.size > 0 && !rarityFilter.has((l.rarity ?? "common") as RarityKey)) return false;
      if (l.market.price < min || l.market.price > max) return false;
      if (l.attributes.power < minPower) return false;
      if (l.attributes.speed < minSpeed) return false;
      if (l.attributes.stamina < minStamina) return false;
      if (q && !l.name.toLowerCase().includes(q) && !String(l.minted_number ?? "").includes(q)) return false;
      return true;
    });
    arr = [...arr];
    if (sort === "latest") arr.sort((a, b) => b.market.created - a.market.created);
    else if (sort === "price_asc") arr.sort((a, b) => a.market.price - b.market.price);
    else if (sort === "price_desc") arr.sort((a, b) => b.market.price - a.market.price);
    else if (sort === "stats") arr.sort((a, b) => statTotal(b) - statTotal(a));
    else if (sort === "rarity")
      arr.sort(
        (a, b) =>
          RARITY_ORDER.indexOf((b.rarity ?? "common") as RarityKey) -
          RARITY_ORDER.indexOf((a.rarity ?? "common") as RarityKey),
      );
    return arr;
  }, [listings, rarityFilter, priceMin, priceMax, minPower, minSpeed, minStamina, sort, query]);

  const toggleRarity = (r: RarityKey) => {
    setRarityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  };

  const resetAll = () => {
    setRarityFilter(new Set());
    setPriceMin(""); setPriceMax("");
    setMinPower(0); setMinSpeed(0); setMinStamina(0);
    setQuery("");
  };

  const activeCount =
    (rarityFilter.size > 0 ? 1 : 0) + (priceMin ? 1 : 0) + (priceMax ? 1 : 0) +
    (minPower > 0 ? 1 : 0) + (minSpeed > 0 ? 1 : 0) + (minStamina > 0 ? 1 : 0) + (query ? 1 : 0);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 20% 0%, rgba(250,204,21,0.08) 0%, transparent 55%)," +
          "radial-gradient(ellipse at 80% 100%, rgba(168,85,247,0.08) 0%, transparent 55%)," +
          `${INK}`,
        color: CREAM,
        fontFamily: PIXEL_BODY,
      }}
    >
      <style>{`
        .bm-mkt-head {
          max-width: 1440px;
          margin: 0 auto;
          padding: 18px 28px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 24px;
        }
        .bm-mkt-body {
          max-width: 1440px;
          margin: 0 auto;
          padding: 28px;
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 24px;
        }
        .bm-mkt-aside {
          align-self: start;
          position: sticky;
          top: 160px;
        }
        @media (max-width: 820px) {
          .bm-mkt-head {
            grid-template-columns: 1fr auto;
            grid-template-areas: "brand balance" "search search";
            padding: 14px 16px;
            gap: 12px;
          }
          .bm-mkt-brand   { grid-area: brand; }
          .bm-mkt-balance { grid-area: balance; }
          .bm-mkt-search  { grid-area: search; }
          .bm-mkt-body {
            grid-template-columns: 1fr;
            padding: 16px;
          }
          .bm-mkt-aside {
            position: static;
            top: auto;
          }
        }
      `}</style>
      {/* Sticky top header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(8px)", background: "rgba(10,10,10,0.85)", borderBottom: `2px solid ${LINE}` }}>
        <div className="bm-mkt-head">
          {/* Brand + breadcrumb */}
          <div className="bm-mkt-brand" style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
            <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              <img src="/assets/brand_logo.png" alt="Boom Miner" style={{ height: 40, width: "auto", imageRendering: "pixelated" }} />
            </Link>
            <div style={{ fontFamily: PIXEL_HEAD, fontSize: 9, letterSpacing: 2, color: SUB, display: "flex", gap: 10, alignItems: "center" }}>
              <span>MINES</span>
              <span style={{ color: LINE }}>/</span>
              <span style={{ color: GOLD }}>MARKETPLACE</span>
            </div>
          </div>
          {/* Search */}
          <div className="bm-mkt-search" style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", background: "#000", border: `2px solid ${LINE}`, padding: "8px 14px", width: "min(420px, 100%)", gap: 10 }}>
              <span style={{ fontFamily: PIXEL_HEAD, fontSize: 10, color: SUB }}>⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by hero name or #ID" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: CREAM, fontFamily: PIXEL_BODY, fontSize: 16 }} />
            </div>
          </div>
          {/* Balance + back */}
          <div className="bm-mkt-balance" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#000", border: `2px solid ${GOLD}`, boxShadow: "4px 4px 0 #000" }}>
              <img src="/assets/token.png" alt="" style={{ width: 22, height: 22, imageRendering: "pixelated" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontFamily: PIXEL_HEAD, fontSize: 7, color: SUB, letterSpacing: 2 }}>BALANCE</span>
                <span style={{ fontFamily: PIXEL_HEAD, fontSize: 11, color: GOLD, letterSpacing: 1 }}>{formatCoins(coins)}</span>
              </div>
            </div>
            <Link href="/game" style={{ fontFamily: PIXEL_HEAD, fontSize: 10, letterSpacing: 2, padding: "12px 18px", background: "#7a1c1c", color: "#fff", textDecoration: "none", border: "none", borderBottom: "4px solid #4a1010" }}>
              ← GAME
            </Link>
          </div>
        </div>
        {/* Filter chip row */}
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 28px 14px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: PIXEL_HEAD, fontSize: 8, color: SUB, letterSpacing: 2, marginRight: 6 }}>RARITY</span>
          {RARITY_ORDER.map((r) => {
            const meta = RARITY_META[r];
            const active = rarityFilter.has(r);
            return (
              <button key={r} type="button" onClick={() => toggleRarity(r)} style={{ fontFamily: PIXEL_HEAD, fontSize: 8, letterSpacing: 1.5, padding: "8px 12px", border: `2px solid ${meta.color}`, background: active ? meta.color : "transparent", color: active ? (r === "legendary" ? "#000" : "#fff") : meta.color, cursor: "pointer", boxShadow: active ? `0 0 12px ${meta.glow}` : "none" }}>
                {meta.label.toUpperCase()}
              </button>
            );
          })}
          {activeCount > 0 && (
            <button type="button" onClick={resetAll} style={{ marginLeft: "auto", fontFamily: PIXEL_HEAD, fontSize: 8, letterSpacing: 1.5, padding: "8px 12px", background: "transparent", border: `2px dashed ${SUB}`, color: SUB, cursor: "pointer" }}>
              CLEAR {activeCount}
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="bm-mkt-body">
        {/* Sidebar advanced filters */}
        <aside className="bm-mkt-aside" style={{ background: PANEL, border: `2px solid ${LINE}`, padding: 20, display: "flex", flexDirection: "column", gap: 22 }}>
          <FilterSection label="Price Range">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <NumberInput placeholder="Min" value={priceMin} onChange={setPriceMin} />
              <span style={{ color: SUB }}>–</span>
              <NumberInput placeholder="Max" value={priceMax} onChange={setPriceMax} />
            </div>
          </FilterSection>
          <div style={{ borderTop: `1px dashed ${LINE}` }} />
          <FilterSection label="Minimum Stats">
            <StatFilter label="Power" value={minPower} onChange={setMinPower} color="#fb923c" />
            <StatFilter label="Speed" value={minSpeed} onChange={setMinSpeed} color="#22d3ee" />
            <StatFilter label="Stamina" value={minStamina} onChange={setMinStamina} color="#4ade80" />
          </FilterSection>
          <div style={{ borderTop: `1px dashed ${LINE}` }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: PIXEL_BODY, fontSize: 14, color: SUB, lineHeight: 1.5 }}>
            <span style={{ fontFamily: PIXEL_HEAD, fontSize: 8, color: GOLD, letterSpacing: 2 }}>MARKET INFO</span>
            <span>Listings: {listings.length}</span>
            <span>Currency: $BMCOIN</span>
            <span>Fees: 0%</span>
          </div>
        </aside>

        {/* Grid */}
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "10px 14px", background: PANEL, border: `2px solid ${LINE}` }}>
            <span style={{ fontFamily: PIXEL_HEAD, fontSize: 10, color: SUB, letterSpacing: 1 }}>
              FOUND <span style={{ color: CREAM }}>{filtered.length}</span> / {listings.length} HEROES
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: PIXEL_HEAD, fontSize: 8, color: SUB, letterSpacing: 2 }}>SORT</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ background: "#000", border: `2px solid ${LINE}`, color: CREAM, padding: "8px 10px", fontFamily: PIXEL_HEAD, fontSize: 9, letterSpacing: 1, outline: "none" }}>
                <option value="latest">LATEST LISTED</option>
                <option value="price_asc">LOWEST PRICE</option>
                <option value="price_desc">HIGHEST PRICE</option>
                <option value="stats">HIGHEST STATS</option>
                <option value="rarity">RARITY</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: SUB, fontFamily: PIXEL_HEAD, fontSize: 11, letterSpacing: 2, border: `2px dashed ${LINE}`, background: PANEL }}>
              NO HEROES MATCH THESE FILTERS
              <div style={{ marginTop: 16 }}>
                <button type="button" onClick={resetAll} style={{ fontFamily: PIXEL_HEAD, fontSize: 9, letterSpacing: 2, padding: "10px 16px", background: GOLD, color: "#000", border: "none", borderBottom: "4px solid #7a5c00", cursor: "pointer" }}>
                  RESET FILTERS
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {filtered.map((h) => (
                <ListingCard key={h.id} hero={h} canAfford={coins >= h.market.price} onBuy={() => buyListing(h.id)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <footer style={{ textAlign: "center", padding: "40px 20px", fontFamily: PIXEL_HEAD, fontSize: 8, letterSpacing: 2, color: SUB, opacity: 0.7 }}>
        © BOOM MINER — MARKETPLACE PROTOTYPE
      </footer>
    </main>
  );
}

/* ---------- subcomponents ---------- */

function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: SUB, letterSpacing: 2 }}>{label.toUpperCase()}</p>
      {children}
    </div>
  );
}

function NumberInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <input type="number" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: "#000", border: `2px solid ${LINE}`, color: CREAM, padding: "8px 10px", fontFamily: PIXEL_BODY, fontSize: 15, outline: "none" }} />
  );
}

function StatFilter({ label, value, onChange, color }: { label: string; value: number; onChange: (n: number) => void; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: CREAM, letterSpacing: 1 }}>{label.toUpperCase()}</span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color, letterSpacing: 1 }}>{String(value).padStart(2, "0")}+</span>
      </div>
      <input type="range" min={0} max={16} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ accentColor: color }} />
    </div>
  );
}

function ListingCard({ hero, canAfford, onBuy }: { hero: RosterHero; canAfford: boolean; onBuy: () => void }) {
  const rarityKey = (hero.rarity ?? "common") as RarityKey;
  const meta = RARITY_META[rarityKey];
  const a = hero.attributes;

  return (
    <article style={{ position: "relative", display: "flex", flexDirection: "column", background: PANEL, border: `3px solid ${meta.color}`, boxShadow: `0 0 22px ${meta.glow}, 6px 6px 0 #000` }}>
      <span style={{ position: "absolute", top: -1, left: -1, background: meta.color, color: rarityKey === "legendary" ? "#000" : "#fff", fontFamily: PIXEL_HEAD, fontSize: 7, letterSpacing: 1.5, padding: "4px 8px" }}>
        {meta.label.toUpperCase()}
      </span>
      <div style={{ height: 160, background: `radial-gradient(circle at 50% 60%, ${meta.glow} 0%, transparent 70%), linear-gradient(180deg, ${INK} 0%, #050510 100%)`, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `2px solid ${meta.color}` }}>
        <div style={{ transform: "scale(1.6)" }}>
          <HeroSprite type={hero.type} size={64} />
        </div>
      </div>
      <div style={{ padding: "12px 14px 8px", borderBottom: `1px dashed ${LINE}` }}>
        <div style={{ fontFamily: PIXEL_HEAD, fontSize: 10, color: meta.color, letterSpacing: 1, lineHeight: 1.3 }}>{hero.name.toUpperCase()}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontFamily: PIXEL_HEAD, fontSize: 8, color: SUB, letterSpacing: 1 }}>
          <span>#{String(hero.minted_number ?? 0).padStart(7, "0")}</span>
          <span style={{ padding: "2px 7px", background: "#000", color: meta.color, border: `1px solid ${meta.color}` }}>LVL {String(hero.level).padStart(2, "0")}</span>
        </div>
      </div>
      <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, borderBottom: `1px dashed ${LINE}` }}>
        <Stat label="PWR" value={a.power} color="#fb923c" />
        <Stat label="SPD" value={a.speed} color="#22d3ee" />
        <Stat label="STM" value={a.stamina} color="#4ade80" />
        <Stat label="BMB" value={a.bomb_number} color="#fff" />
        <Stat label="RNG" value={a.bomb_range} color="#e879f9" />
      </div>
      <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: PIXEL_HEAD, fontSize: 7, color: SUB, letterSpacing: 2 }}>PRICE</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <img src="/assets/token.png" alt="" style={{ width: 16, height: 16, imageRendering: "pixelated" }} />
            <span style={{ fontFamily: PIXEL_HEAD, fontSize: 13, color: GOLD, letterSpacing: 1 }}>{hero.market.price.toFixed(1)}</span>
          </div>
        </div>
        <button type="button" onClick={onBuy} disabled={!canAfford} style={{ padding: "12px 16px", background: canAfford ? meta.color : LINE, color: rarityKey === "legendary" && canAfford ? "#000" : "#fff", border: "none", borderBottom: `4px solid ${canAfford ? "#000" : "#0a0a10"}`, fontFamily: PIXEL_HEAD, fontSize: 9, letterSpacing: 2, cursor: canAfford ? "pointer" : "not-allowed", opacity: canAfford ? 1 : 0.55 }}>
          {canAfford ? "BUY" : "TOO POOR"}
        </button>
      </div>
    </article>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 0", background: "#000", border: `1px solid ${LINE}` }}>
      <span style={{ fontFamily: PIXEL_HEAD, fontSize: 6, color: SUB, letterSpacing: 1 }}>{label}</span>
      <span style={{ fontFamily: PIXEL_HEAD, fontSize: 11, color, letterSpacing: 1 }}>{String(value).padStart(2, "0")}</span>
    </div>
  );
}

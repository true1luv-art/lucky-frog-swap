"use client";

import { useEffect, useState } from "react";
import { OuterPanel, InnerPanel } from "@/components/ui/Panel";

interface HoldersData {
  holders: Array<{
    rank: number;
    address: string;
    balance: number;
    pct: number;
  }>;
  totalSupply: number;
  updatedAt: number;
}

interface GameStatsData {
  totalLfrgEmitted: number;
  halvingStage: number;
  emissionMultiplier: number;
}

const TREASURY_OWNER = "Eka1aTLUgrRv4uE5htxHYpaRrZTeKRdDH2UWjsCRP1TD";

function fmtBalance(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(2);
}

function fmtPrice(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.000001) return "$" + n.toExponential(2);
  if (n < 0.01) return "$" + n.toFixed(8);
  return "$" + n.toFixed(6);
}

function fmtUsd(n: number) {
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(2) + "K";
  return "$" + n.toFixed(2);
}

function abbrev(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-6);
}

export default function GameStats() {
  const [holdersData, setHoldersData] = useState<HoldersData | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
  const [fdv, setFdv] = useState<number | null>(null);
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  const [gameStatsData, setGameStatsData] = useState<GameStatsData | null>(null);
  const [loadingHolders, setLoadingHolders] = useState(true);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [loadingGameStats, setLoadingGameStats] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const fetchHolders = async () => {
    try {
      const res = await fetch("/api/holders");
      const json = await res.json();
      if (json.error) return;
      setHoldersData(json);
      const treasury = json.holders.find(
        (h: { address: string }) => h.address === TREASURY_OWNER
      );
      setTreasuryBalance(treasury?.balance ?? 0);
      setUpdatedAt(json.updatedAt);
    } finally {
      setLoadingHolders(false);
    }
  };

  const fetchGameStats = async () => {
    try {
      const res = await fetch("/api/game-stats");
      const json = await res.json();
      if (!json.error) {
        setGameStatsData(json);
      }
    } finally {
      setLoadingGameStats(false);
    }
  };

  const fetchPrice = async () => {
    try {
      const res = await fetch("/api/price");
      const json = await res.json();
      if (!json.error) {
        setPrice(json.price);
        setPriceChange24h(json.priceChange24h ?? null);
        setFdv(json.fdv ?? null);
      }
    } finally {
      setLoadingPrice(false);
    }
  };

  useEffect(() => {
    fetchHolders();
    fetchPrice();
    fetchGameStats();
    const holdersInterval = setInterval(fetchHolders, 2 * 60 * 1000);
    const priceInterval = setInterval(fetchPrice, 30 * 1000);
    const gameStatsInterval = setInterval(fetchGameStats, 60 * 1000);
    return () => {
      clearInterval(holdersInterval);
      clearInterval(priceInterval);
      clearInterval(gameStatsInterval);
    };
  }, []);

  return (
    <section id="token-stats" className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="mb-10 text-center">
        <h2 className="font-pixel text-xl text-neon sm:text-2xl md:text-3xl">
          $LFRG STATS
        </h2>
        <p className="mt-3 font-body text-base text-brown-700 sm:text-lg">
          Live numbers from the swamp.
        </p>
      </div>

      <OuterPanel>
        {/* Row 1 — Price & Market Cap */}
        <InnerPanel className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y-2 divide-brown-700 sm:divide-x-2 sm:divide-y-0">
            {/* Price */}
            <div className="flex flex-col gap-2 px-5 py-5">
              <span className="font-pixel text-[8px] uppercase text-white/60 tracking-widest">
                Price
              </span>
              {loadingPrice ? (
                <div className="animate-pulse h-7 w-24 bg-brown-400 rounded-sm" />
              ) : (
                <span className="font-pixel text-2xl text-neon leading-none sm:text-3xl text-shadow">
                  {price !== null ? fmtPrice(price) : "—"}
                </span>
              )}
              <span className="font-body text-[9px]">
                {priceChange24h !== null ? (
                  <span className={priceChange24h >= 0 ? "text-neon" : "text-rose"}>
                    {priceChange24h >= 0 ? "+" : ""}{priceChange24h.toFixed(2)}% 24h
                  </span>
                ) : (
                  <span className="text-white/50">$LFRG / USD</span>
                )}
              </span>
            </div>

            {/* Market Cap */}
            <div className="flex flex-col gap-2 px-5 py-5">
              <span className="font-pixel text-[8px] uppercase text-white/60 tracking-widest">
                Market Cap
              </span>
              {loadingPrice ? (
                <div className="animate-pulse h-7 w-24 bg-brown-400 rounded-sm" />
              ) : (
                <span className="font-pixel text-2xl text-neon leading-none sm:text-3xl text-shadow">
                  {fdv !== null && fdv > 0 ? fmtUsd(fdv) : "—"}
                </span>
              )}
              <span className="font-body text-[9px] text-white/50">fully diluted value</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-brown-700" />

          {/* Row 2 — Supply, Treasury, Holders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y-2 divide-brown-700 sm:divide-x-2 sm:divide-y-0">
            <div className="flex flex-col gap-2 px-5 py-4">
              <span className="font-pixel text-[8px] uppercase text-white/60 tracking-widest">
                Total Supply
              </span>
              {loadingHolders ? (
                <div className="animate-pulse h-6 w-20 bg-brown-400 rounded-sm" />
              ) : (
                <span className="font-pixel text-xl text-neon leading-none sm:text-2xl text-shadow">
                  {holdersData ? fmtBalance(holdersData.totalSupply) : "—"}
                </span>
              )}
              <span className="font-body text-[9px] text-white/50">$LFRG tokens</span>
            </div>

            <div className="flex flex-col gap-2 px-5 py-4">
              <span className="font-pixel text-[8px] uppercase text-white/60 tracking-widest">
                Treasury Balance
              </span>
              {loadingHolders ? (
                <div className="animate-pulse h-6 w-20 bg-brown-400 rounded-sm" />
              ) : (
                <span className="font-pixel text-xl text-neon leading-none sm:text-2xl text-shadow">
                  {treasuryBalance !== null ? fmtBalance(treasuryBalance) : "—"}
                </span>
              )}
              <span className="font-body text-[9px] text-white/50 truncate">
                {abbrev(TREASURY_OWNER)}
              </span>
            </div>

            <div className="flex flex-col gap-2 px-5 py-4">
              <span className="font-pixel text-[8px] uppercase text-white/60 tracking-widest">
                Holders
              </span>
              {loadingHolders ? (
                <div className="animate-pulse h-6 w-20 bg-brown-400 rounded-sm" />
              ) : (
                <span className="font-pixel text-xl text-neon leading-none sm:text-2xl text-shadow">
                  {holdersData ? holdersData.holders.length.toString() : "—"}
                </span>
              )}
              <span className="font-body text-[9px] text-white/50">unique wallets</span>
            </div>
          </div>

          {/* Footer timestamp */}
          {updatedAt && (
            <div className="border-t-2 border-brown-700 px-5 py-2 text-right">
              <span className="font-pixel text-[8px] text-white/50">
                Updated:{" "}
                {new Date(updatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          )}
        </InnerPanel>
      </OuterPanel>
    </section>
  );
}

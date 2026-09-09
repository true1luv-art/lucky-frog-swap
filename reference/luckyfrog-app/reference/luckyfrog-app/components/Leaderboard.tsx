"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { OuterPanel, InnerPanel } from "@/components/ui/Panel";

interface Holder {
  rank: number;
  address: string;
  balance: number;
  pct: number;
}

interface HoldersData {
  holders: Holder[];
  totalSupply: number;
  updatedAt: number;
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)         return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(2);
}

function abbrev(addr: string) {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

const FILTERED_ADDRESSES = new Set([
  "Eka1aTLUgrRv4uE5htxHYpaRrZTeKRdDH2UWjsCRP1TD",
]);

const RANK_STYLES: Record<number, { label: string; color: string }> = {
  1: { label: "👑", color: "text-gold" },
  2: { label: "🥈", color: "text-white" },
  3: { label: "🥉", color: "text-rose" },
};

export default function Leaderboard() {
  const [data, setData]                         = useState<HoldersData | null>(null);
  const [error, setError]                       = useState<string | null>(null);
  const [initialLoading, setInitialLoading]     = useState(true);
  const [changedAddresses, setChangedAddresses] = useState<Set<string>>(new Set());
  const prevDataRef                             = useRef<HoldersData | null>(null);

  const load = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setInitialLoading(true);
      setError(null);

      const res  = await fetch("/api/holders");
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      if (prevDataRef.current) {
        const prevMap = new Map(prevDataRef.current.holders.map((h) => [h.address, h]));
        const changed = new Set<string>();
        for (const h of json.holders as Holder[]) {
          const prev = prevMap.get(h.address);
          if (!prev || prev.balance !== h.balance || prev.rank !== h.rank) changed.add(h.address);
        }
        for (const prev of prevDataRef.current.holders) {
          if (!json.holders.find((h: Holder) => h.address === prev.address)) changed.add(prev.address);
        }
        if (changed.size > 0) {
          setChangedAddresses(changed);
          setTimeout(() => setChangedAddresses(new Set()), 1500);
        }
      }

      prevDataRef.current = json;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const interval = setInterval(() => load(true), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <section id="leaderboard" className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <style>{`
        @keyframes rowBlink {
          0%   { opacity: 1; }
          25%  { opacity: 0.7; }
          50%  { opacity: 1; }
          75%  { opacity: 0.7; }
          100% { opacity: 1; }
        }
        .row-blink { animation: rowBlink 1.2s ease-in-out; }
      `}</style>

      <div className="mb-10 text-center">
        <h2 className="font-pixel text-xl text-neon sm:text-2xl md:text-3xl">
          TOP HOLDERS
        </h2>
        <p className="mt-3 font-body text-xl text-brown-700">
          The luckiest frogs in the swamp.
        </p>
      </div>

      <OuterPanel>
        {/* Table header */}
        <InnerPanel className="overflow-hidden p-0">
          <div className="grid grid-cols-[40px_1fr_auto_auto] gap-x-4 border-b-4 border-brown-700 px-4 py-3 font-pixel text-[9px] uppercase text-white/70 sm:grid-cols-[48px_1fr_auto_auto] sm:px-6">
            <span className="text-center">#</span>
            <span>Wallet</span>
            <span className="text-right">Balance</span>
            <span className="text-right w-14">% Supply</span>
          </div>

          {/* Initial skeleton */}
          {initialLoading && (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-sm bg-brown-400/50"
                  style={{ animationDelay: `${i * 0.05}s` }}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && !data && (
            <div className="p-8 text-center">
              <p className="font-pixel text-[10px] text-rose text-shadow">Failed to load holders</p>
              <p className="mt-2 font-body text-base text-white/70">{error}</p>
              <button
                onClick={() => load(false)}
                className="mt-4 border-2 border-neon bg-brown-400 px-4 py-2 font-pixel text-[9px] uppercase text-neon text-shadow transition hover:bg-neon hover:text-white"
              >
                Retry
              </button>
            </div>
          )}

          {/* Data rows */}
          {data && (
            <>
              {data.holders
                .filter((h) => !FILTERED_ADDRESSES.has(h.address))
                .slice(0, 20)
                .map((h, i, filtered) => {
                  const style    = RANK_STYLES[h.rank];
                  const barWidth = Math.min(h.pct * 4, 100);
                  const isChanged = changedAddresses.has(h.address);

                  return (
                    <div
                      key={h.address}
                      className={`relative grid grid-cols-[40px_1fr_auto_auto] gap-x-4 items-center px-4 py-3 sm:grid-cols-[48px_1fr_auto_auto] sm:px-6 hover:bg-brown-400/30 transition-colors ${
                        i < filtered.length - 1 ? "border-b-2 border-brown-700/50" : ""
                      } ${isChanged ? "row-blink" : ""}`}
                    >
                      {/* Progress bar bg */}
                      <div
                        className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{
                          background: `linear-gradient(to right, var(--color-neon) ${barWidth}%, transparent ${barWidth}%)`,
                        }}
                        aria-hidden="true"
                      />

                      {/* Rank */}
                      <div className="relative text-center">
                        {style ? (
                          <span className="text-lg leading-none">{style.label}</span>
                        ) : (
                          <span className="font-pixel text-[9px] text-white/60">{h.rank}</span>
                        )}
                      </div>

                      {/* Address */}
                      <div className="relative min-w-0">
                        <a
                          href={`https://solscan.io/account/${h.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className={`font-pixel text-[9px] sm:text-[10px] transition hover:text-neon ${
                            style ? style.color : "text-white"
                          }`}
                          title={h.address}
                        >
                          {abbrev(h.address)}
                        </a>
                      </div>

                      {/* Balance */}
                      <div className="relative text-right">
                        <span className="font-body text-base text-white sm:text-lg">
                          {fmt(h.balance)}
                        </span>
                        <span className="ml-1 font-pixel text-[8px] text-white/50">$LFRG</span>
                      </div>

                      {/* Percent */}
                      <div className="relative w-14 text-right">
                        <span className={`font-pixel text-[9px] sm:text-[10px] text-shadow ${style ? style.color : "text-neon"}`}>
                          {h.pct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}

              {/* Footer */}
              <div className="flex items-center justify-between border-t-4 border-brown-700 px-4 py-3 sm:px-6">
                <span className="font-body text-base text-white/70">
                  Supply: {fmt(data.totalSupply)} $LFRG
                </span>
                <span className="font-pixel text-[8px] text-white/50">
                  Updated {new Date(data.updatedAt).toLocaleTimeString()}
                </span>
              </div>
            </>
          )}
        </InnerPanel>
      </OuterPanel>

      <p className="mt-4 text-center font-body text-base text-brown-700">
        Showing top 20 holders &middot; Data from Solana mainnet &middot;{" "}
        <a
          href="https://solscan.io/token/rguPVQY61jq14vwShEaNuSiCXYGG3bwWzwa3XJHpump#holders"
          target="_blank"
          rel="noreferrer"
          className="text-neon transition hover:underline"
        >
          View all on Solscan
        </a>
      </p>
    </section>
  );
}

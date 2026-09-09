

import { useEffect, useState } from "react";
import { OuterPanel, InnerPanel } from "@/components/ui/Panel";

interface GameStatsData {
  totalHfarmEmitted:          number;
  totalDailyQuestsCompleted:  number;
  totalWeeklyQuestsCompleted: number;
}

function abbrev(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(0);
}

export default function GameStats() {
  const [gameStatsData, setGameStatsData] = useState<GameStatsData | null>(null);
  const [loadingGameStats, setLoadingGameStats] = useState(true);

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

  useEffect(() => {
    fetchGameStats();
    const interval = setInterval(fetchGameStats, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="game-stats" className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="mb-10 text-center">
        <h2 className="font-pixel text-xl text-neon sm:text-2xl md:text-3xl">
          LIVE FARM STATS
        </h2>
        <p className="mt-3 font-body text-base text-brown-700 sm:text-lg">
          Real numbers from the farm economy.
        </p>
      </div>

      <OuterPanel>
        <InnerPanel className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y-2 divide-brown-700 sm:divide-x-2 sm:divide-y-0">
            <div className="flex flex-col gap-2 px-5 py-4">
              <span className="font-pixel text-[8px] uppercase text-white/60 tracking-widest">
                Coins Emitted
              </span>
              {loadingGameStats ? (
                <div className="animate-pulse h-6 w-20 bg-brown-400 rounded-sm" />
              ) : (
                <span className="font-pixel text-xl text-neon leading-none sm:text-2xl text-shadow">
                  {gameStatsData ? abbrev(gameStatsData.totalHfarmEmitted) : "—"}
                </span>
              )}
              <span className="font-body text-[9px] text-white/50">total $HFARM emitted</span>
            </div>

            <div className="flex flex-col gap-2 px-5 py-4">
              <span className="font-pixel text-[8px] uppercase text-white/60 tracking-widest">
                Daily Quests
              </span>
              {loadingGameStats ? (
                <div className="animate-pulse h-6 w-20 bg-brown-400 rounded-sm" />
              ) : (
                <span className="font-pixel text-xl text-neon leading-none sm:text-2xl text-shadow">
                  {gameStatsData ? abbrev(gameStatsData.totalDailyQuestsCompleted) : "—"}
                </span>
              )}
              <span className="font-body text-[9px] text-white/50">quests completed</span>
            </div>

            <div className="flex flex-col gap-2 px-5 py-4">
              <span className="font-pixel text-[8px] uppercase text-white/60 tracking-widest">
                Weekly Quests
              </span>
              {loadingGameStats ? (
                <div className="animate-pulse h-6 w-20 bg-brown-400 rounded-sm" />
              ) : (
                <span className="font-pixel text-xl text-neon leading-none sm:text-2xl text-shadow">
                  {gameStatsData ? abbrev(gameStatsData.totalWeeklyQuestsCompleted) : "—"}
                </span>
              )}
              <span className="font-body text-[9px] text-white/50">quests completed</span>
            </div>
          </div>
        </InnerPanel>
      </OuterPanel>
    </section>
  );
}

import React, { useEffect, useState } from "react";

const lightning = "/assets/icons/lightning.png";

import { useGameStore } from "@/lib/stores/game/useGameStore";
import {
  getTimeUntilNextRegen,
  formatRegenTime,
  STAMINA_CONSTANTS,
} from "@/shared/game/stamina";
import { AvatarMenu } from "@/components/game/hud/components/AvatarMenu";
import { Balance } from "@/components/game/hud/components/Balance";
import { HudStatusWidget, useHudProfile } from "@/components/game/hud/components/HudStatusWidget";

export const PlayerHud: React.FC<{ wallet?: string }> = ({ wallet }) => {
  const state    = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);

  const stamina            = state.stamina ?? { current: 100, max: 100 };
  const lastStaminaRegenAt = state.lastStaminaRegenAt ?? Date.now();
  const username           = state.username ?? "Hero";

  const [timeUntilRegen, setTimeUntilRegen] = useState<string>("");
  const [showTooltip, setShowTooltip]       = useState(false);

  // §2.9 — equipped avatar frog portrait replaces the generated avatar.
  const { data: profile } = useHudProfile(wallet);
  const avatarFrogImage = profile?.avatarFrog?.image ?? null;

  const percentage = stamina.max > 0 ? (stamina.current / stamina.max) * 100 : 100;

  useEffect(() => {
    dispatch({ type: "stamina.regenerate" });

    const updateTimer = () => {
      if (stamina.current < stamina.max) {
        const timeMs = getTimeUntilNextRegen(lastStaminaRegenAt);
        setTimeUntilRegen(formatRegenTime(timeMs));
      } else {
        setTimeUntilRegen("");
      }
    };

    updateTimer();
    const interval      = setInterval(updateTimer, 1000);
    const regenInterval = setInterval(() => dispatch({ type: "stamina.regenerate" }), 60000);

    return () => {
      clearInterval(interval);
      clearInterval(regenInterval);
    };
  }, [dispatch, stamina.current, stamina.max, lastStaminaRegenAt]);

  const getBarColor = () => {
    if (percentage > 50) return "bg-green-500";
    if (percentage > 25) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <>
    <div className="fixed top-2 left-2 z-50 flex items-center gap-1 sm:gap-2">
      <div className="scale-75 sm:scale-100 origin-top-left">
        <AvatarMenu name={username} avatarImage={avatarFrogImage} avatarFrog={profile?.avatarFrog ?? null} />
      </div>

      <div className="flex flex-col min-w-[72px] sm:min-w-[110px]">
        <span className="text-white font-bold text-xs sm:text-base leading-tight text-outline-lg tracking-wide">
          {username}
        </span>

        <div
          className="flex items-center gap-0.5 sm:gap-1 cursor-pointer relative mt-0.5"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <img
            src={typeof lightning === "string" ? lightning : (lightning as { src: string })?.src}
            alt="Stamina"
            className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0"
          />
          <div className="flex-1 h-2 sm:h-2.5 bg-gray-800 rounded-full overflow-hidden min-w-[40px] sm:min-w-[56px] border border-black/60">
            <div className={`h-full ${getBarColor()} transition-all duration-300`} style={{ width: `${percentage}%` }} />
          </div>
          <span className="text-white font-bold text-xs sm:text-sm text-outline ml-0.5 sm:ml-1 tabular-nums leading-none">
            {stamina.current}
          </span>

          {showTooltip && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-brown-200 border-2 border-brown-400 rounded-md shadow-lg z-50 min-w-[140px] sm:min-w-[160px]">
              <p className="text-white font-bold text-xs text-outline mb-1">
                Stamina: {stamina.current}/{stamina.max}
              </p>
              {stamina.current < stamina.max && timeUntilRegen && (
                <p className="text-white text-xs text-outline">
                  Next +{Math.ceil(stamina.max * STAMINA_CONSTANTS.STAMINA_REGEN_PERCENT)} in {timeUntilRegen}
                </p>
              )}
              <p className="text-gray-300 text-xs mt-1">Actions cost 1 stamina</p>
            </div>
          )}
        </div>

        <Balance />

        <HudStatusWidget wallet={wallet} />
      </div>
    </div>
    </>
  );
};

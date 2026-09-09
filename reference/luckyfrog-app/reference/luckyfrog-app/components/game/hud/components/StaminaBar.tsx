import React, { useEffect, useState } from "react";

import { InnerPanel } from "@/components/ui/Panel";
import { useGameStore } from "@/lib/stores/game/useGameStore";
import {
  getTimeUntilNextRegen,
  formatRegenTime,
  STAMINA_CONSTANTS,
} from "@/shared/game/stamina";

const lightning = "/assets/icons/lightning.png";

/**
 * StaminaBar — top-right HUD panel showing current/max stamina.
 *
 * Matches the reference hearthvale StaminaBar but updated to use
 * the current codebase's import paths (@/phaser/…).
 *
 * Rendered inside PlayerHud, positioned `fixed top-2 right-36`.
 */
export const StaminaBar: React.FC = () => {
  const state    = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);

  // Provide default values for backwards compatibility with existing saves
  const stamina            = state.stamina ?? { current: 100, max: 100 };
  const lastStaminaRegenAt = state.lastStaminaRegenAt ?? Date.now();

  const [timeUntilRegen, setTimeUntilRegen] = useState<string>("");
  const [showTooltip, setShowTooltip]       = useState(false);

  const percentage = stamina.max > 0 ? (stamina.current / stamina.max) * 100 : 100;

  // Check for stamina regen on mount and periodically
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
    const regenInterval = setInterval(() => {
      dispatch({ type: "stamina.regenerate" });
    }, 60000);

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
    <div
      className="fixed top-2 right-36 z-50 cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <InnerPanel className="flex items-center shadow-lg min-w-[120px]">
        <img
          src={lightning}
          alt="Stamina"
          className="w-6 h-6 img-highlight"
        />
        <div className="flex flex-col ml-2 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-white text-xs text-shadow">
              {stamina.current}/{stamina.max}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getBarColor()} transition-all duration-300`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </InnerPanel>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-brown-200 border-2 border-brown-400 rounded-md shadow-lg z-50 min-w-[180px]">
          <p className="text-white text-xs text-shadow mb-1">
            Stamina: {stamina.current}/{stamina.max}
          </p>
          {stamina.current < stamina.max && timeUntilRegen && (
            <p className="text-white text-xs text-shadow">
              Next +{Math.ceil(stamina.max * STAMINA_CONSTANTS.STAMINA_REGEN_PERCENT)} in {timeUntilRegen}
            </p>
          )}
          <p className="text-gray-300 text-xs mt-1">
            Harvesting and mining costs 1 stamina
          </p>
        </div>
      )}
    </div>
  );
};

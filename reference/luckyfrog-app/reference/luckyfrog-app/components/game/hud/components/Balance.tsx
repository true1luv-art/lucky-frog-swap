import React, { useState } from "react";
import Decimal from "decimal.js-light";
import { useGameStore } from "@/lib/stores/game/useGameStore";

export const Balance: React.FC = () => {
  const balance = useGameStore((s) => s.state.balance);
  const [isShown, setIsShown] = useState(false);

  return (
    <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5">
      <img
        src="/assets/icons/token.png"
        alt="coin"
        className="w-3.5 h-3.5 sm:w-5 sm:h-5 img-highlight flex-shrink-0"
      />
      <span
        className="text-white font-bold text-xs sm:text-sm text-outline tabular-nums cursor-default select-none leading-none"
        onMouseEnter={() => setIsShown(true)}
        onMouseLeave={() => setIsShown(false)}
      >
        {isShown ? (
          <small>{new Decimal(balance).toString()}</small>
        ) : (
          new Decimal(balance).toDecimalPlaces(3, Decimal.ROUND_DOWN).toString()
        )}
      </span>
    </div>
  );
};

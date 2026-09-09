/**
 * BowToolButton
 *
 * The player's bow "tool" — always visible in the bottom-right of the game
 * viewport (desktop and touch). Shows the equipped bow tier, its damage, and a
 * cooldown sweep between shots. Tapping/clicking fires the bow by dispatching
 * the "phaser-attack" window event that InputSystem listens for.
 */

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { getBowStats, type BowTier } from "@/features/game/bow";

const BOW_ICON = "/assets/icons/bow.png";

export function BowToolButton() {
  const bowTier = useGameStore((s) => (s.state?.bowTier as BowTier | undefined)) ?? "Wood";
  const stats   = getBowStats(bowTier);

  const [cooling, setCooling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shoot = () => {
    if (cooling) return;
    window.dispatchEvent(new CustomEvent("phaser-attack"));
    setCooling(true);
    timerRef.current = setTimeout(() => setCooling(false), stats.fireRateMs);
  };

  // Keep the on-screen cooldown in sync with the SPACE key too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      setCooling(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCooling(false), stats.fireRateMs);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stats.fireRateMs]);

  return (
    <button
      type="button"
      aria-label={`Shoot ${bowTier} bow`}
      onPointerDown={(e) => { e.preventDefault(); shoot(); }}
      className="pointer-events-auto fixed bottom-28 right-4 z-40 flex h-16 w-16 select-none flex-col items-center justify-center rounded-xl transition-transform active:translate-y-[2px] md:bottom-24 md:right-6"
      style={{
        border:      "4px solid #5a3e1b",
        background:  cooling ? "#8c7442" : "#c8a45a",
        boxShadow:   cooling ? "0 2px 0 #3b2710" : "0 4px 0 #3b2710",
        opacity:     cooling ? 0.75 : 1,
        touchAction: "none",
      }}
    >
      <img
        src={BOW_ICON}
        alt=""
        width={512}
        height={512}
        loading="lazy"
        draggable={false}
        className="pixelated h-8 w-8 object-contain"
      />
      <span className="font-pixel text-[7px] uppercase leading-none tracking-wider text-[#3b2710]">
        {bowTier} · {stats.damage}
      </span>
    </button>
  );
}

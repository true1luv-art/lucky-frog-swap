/**
 * BowToolButton
 *
 * The player's bow "tool" — always visible in the bottom-right of the game
 * viewport (desktop and touch). Shows the equipped bow tier with the matching
 * rod artwork, a damage readout, and a cooldown sweep between shots.
 *
 * The bow must be equipped before it can be aimed or fired. Tapping the button
 * toggles equip; once equipped, tapping it fires (left click / SPACE also fire).
 */

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { getBowStats, type BowTier } from "@/features/game/bow";

const ROD_BY_TIER: Record<BowTier, string> = {
  Wood:     "/assets/tools/wood_rod.png",
  Iron:     "/assets/tools/iron_rod.png",
  Silver:   "/assets/tools/silver_rod.png",
  Emerald:  "/assets/tools/emerald_rod.png",
  Diamond:  "/assets/tools/diamond_rod.png",
  Ignisite: "/assets/tools/ignisite_rod.png",
};

export function BowToolButton() {
  const bowTier  = useGameStore((s) => (s.state?.bowTier as BowTier | undefined)) ?? "Wood";
  const equipped = useGameStore((s) => s.state?.bowEquipped === true);
  const send     = useGameStore((s) => s.send);
  const stats    = getBowStats(bowTier);

  const [cooling, setCooling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startCooldown = () => {
    setCooling(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCooling(false), stats.fireRateMs);
  };

  const onPress = () => {
    if (!equipped) {
      send({ type: "bow.equip", equipped: true });
      return;
    }
    if (cooling) return;
    window.dispatchEvent(new CustomEvent("phaser-attack"));
    startCooldown();
  };

  const onUnequip = () => send({ type: "bow.equip", equipped: false });

  // Keep the on-screen cooldown in sync with SPACE / left-click firing too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !equipped) return;
      startCooldown();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.fireRateMs, equipped]);

  return (
    <div className="pointer-events-none fixed bottom-28 right-4 z-40 flex flex-col items-center gap-1 md:bottom-24 md:right-6">
      {equipped && (
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); onUnequip(); }}
          className="pointer-events-auto select-none rounded-md px-2 py-0.5 font-pixel text-[7px] uppercase tracking-wider text-[#3b2710]"
          style={{ background: "#e0c98a", border: "2px solid #5a3e1b", touchAction: "none" }}
        >
          Unequip
        </button>
      )}

      <button
        type="button"
        aria-label={equipped ? `Shoot ${bowTier} bow` : `Equip ${bowTier} bow`}
        aria-pressed={equipped}
        onPointerDown={(e) => { e.preventDefault(); onPress(); }}
        className="pointer-events-auto flex h-16 w-16 select-none flex-col items-center justify-center rounded-xl transition-transform active:translate-y-[2px]"
        style={{
          border:      equipped ? "4px solid #f0c040" : "4px solid #5a3e1b",
          background:  cooling ? "#8c7442" : equipped ? "#d9b96a" : "#a08a5a",
          boxShadow:   cooling ? "0 2px 0 #3b2710" : "0 4px 0 #3b2710",
          opacity:     cooling ? 0.75 : equipped ? 1 : 0.85,
          touchAction: "none",
        }}
      >
        <img
          src={ROD_BY_TIER[bowTier] ?? ROD_BY_TIER.Wood}
          alt=""
          loading="lazy"
          draggable={false}
          className="pixelated h-8 w-8 object-contain"
        />
        <span className="font-pixel text-[7px] uppercase leading-none tracking-wider text-[#3b2710]">
          {equipped ? `${bowTier} · ${stats.damage}` : "Equip"}
        </span>
      </button>
    </div>
  );
}

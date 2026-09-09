

/**
 * EquipmentPanel — read-only summary of the player's currently equipped gear
 * plus live aggregate combat stats. Shown inside the House profile.
 * Crafting/upgrading happens at the Blacksmith.
 */

import React from "react";
import type {
  EquipmentItem,
  EquipmentSlot,
  EquipmentStatName,
  EquipmentTier,
} from "@/features/types/gameplay/equipment";
import { EQUIPMENT_SLOTS } from "@/features/types/gameplay/equipment";
import { PERCENT_STATS, computePlayerStats, INITIAL_PLAYER_STATS } from "@/features/game/equipment";
import { ITEM_DETAILS } from "@/features/types/item-details";
import type { InventoryItemName } from "@/features/types/gameplay/game";
import { useGameStore } from "@/features/game-stores/useGameStore";

const TIER_COLOR: Record<EquipmentTier, string> = {
  Wood:     "#a3a3a3",
  Iron:     "#fb923c",
  Silver:   "#e2e8f0",
  Emerald:  "#34d399",
  Diamond:  "#67e8f9",
  Ignisite: "#f87171",
};

function itemImage(name: string): string {
  return ITEM_DETAILS[name as InventoryItemName]?.image ?? "/assets/icons/token.png";
}

function statLines(item?: EquipmentItem): string {
  if (!item) return "Empty";
  const entries = Object.entries(item.stats) as [EquipmentStatName, number][];
  if (entries.length === 0) return "No bonuses";
  return entries
    .map(([n, v]) => `+${v}${PERCENT_STATS.includes(n) ? "%" : ""} ${n}`)
    .join(", ");
}

export function EquipmentPanel() {
  const equipment = useGameStore((s) => s.state?.equipment);
  const equipped = equipment?.equipped;

  // Compute live aggregate stats from what's currently equipped in the store.
  const aggStats = equipped ? computePlayerStats(equipped) : INITIAL_PLAYER_STATS;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-pixel text-[9px] text-white/70 text-shadow uppercase tracking-wide">
        Equipment
      </span>
      <div className="grid grid-cols-2 gap-1">
        {EQUIPMENT_SLOTS.map((slot: EquipmentSlot) => {
          const item = equipped?.[slot];
          const tier = item?.tier ?? "Wood";
          return (
            <div key={slot} className="flex items-center gap-2 rounded-sm bg-black/20 p-1.5">
              <img
                src={itemImage(tier as string) || "/placeholder.svg"}
                alt=""
                className="w-8 h-8 object-contain pixelated shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span
                  className="text-[11px] font-semibold text-shadow truncate"
                  style={{ color: TIER_COLOR[tier] }}
                >
                  {item ? `${item.tier} ${slot}` : slot}
                  {item && item.upgradeLevel > 0 ? ` +${item.upgradeLevel}` : ""}
                </span>
                <span className="text-[9px] text-white/60 text-shadow truncate">
                  {statLines(item)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Aggregate totals row */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5 border-t border-white/10 mt-0.5">
        {(
          [
            { key: "attack",  label: "ATK",  color: "#f87171" },
            { key: "defense", label: "DEF",  color: "#60a5fa" },
            { key: "luck",    label: "LCK%", color: "#fbbf24" },
            { key: "speed",   label: "SPD%", color: "#34d399" },
            { key: "crit",    label: "CRT%", color: "#e879f9" },
          ] as const
        ).map(({ key, label, color }) => (
          <span key={key} className="font-pixel text-[8px] text-white/70 text-shadow">
            {label}{" "}
            <span style={{ color }} className="text-[9px]">
              {aggStats[key]}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

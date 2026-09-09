"use client";

/**
 * components/game/house/GearPanel.tsx
 *
 * Equipped-items list, extracted from the old AvatarMenu "Gear" view so it can
 * live on the House modal's Gear tab (see docs/modal-redesign-plan.md §3).
 * Reads live equipment per slot from useGameStore and renders an icon + label +
 * equipped item + attribute grid per slot.
 */

import React from "react";

import { useGameStore } from "@/lib/stores/game/useGameStore";
import {
  INITIAL_EQUIPMENT,
  type EquipmentAttributes,
  type EquipmentSlotName,
  type EquipmentSlot,
} from "@/shared/types/gameplay/equipment";
import { InnerPanel } from "@/components/ui/Panel";
import { SectionLabel } from "@/components/ui/modal";

const SLOT_META: Record<EquipmentSlotName, { label: string; icon: string }> = {
  weapon:    { label: "Weapon",    icon: "/assets/icons/sword.png"  },
  armor:     { label: "Armor",     icon: "/assets/icons/heart.png"  },
  mount:     { label: "Mount",     icon: "/assets/tools/horse.png"  },
  accessory: { label: "Accessory", icon: "/assets/icons/star.png"   },
  special:   { label: "Special",   icon: "/assets/icons/special.png" },
};

const SLOT_ORDER: EquipmentSlotName[] = ["weapon", "armor", "mount", "accessory", "special"];

const ATTR_LABELS: Array<{ key: keyof EquipmentAttributes; label: string }> = [
  { key: "damage",  label: "DMG"  },
  { key: "defense", label: "DEF"  },
  { key: "dodge",   label: "DOD"  },
  { key: "crit",    label: "CRIT" },
  { key: "mining",  label: "MIN"  },
  { key: "luck",    label: "LCK"  },
];

function GearSlotRow({ slotName, slot }: { slotName: EquipmentSlotName; slot: EquipmentSlot }) {
  const { label, icon } = SLOT_META[slotName];
  return (
    <InnerPanel className="flex items-start gap-2 p-1.5">
      <div className="flex flex-col items-center w-16 flex-shrink-0">
        <img
          src={icon || "/placeholder.svg"}
          alt={label}
          className="w-6 h-6"
          style={{ imageRendering: "pixelated" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <span className="text-white text-[10px] text-shadow mt-0.5 leading-none text-center w-full truncate">{label}</span>
      </div>
      {slot.item_equipped ? (
        <div className="flex-1 min-w-0">
          <span className="text-white text-xs text-shadow block mb-1">#{slot.item_number ?? "?"} — {slot.item_id ?? "Unknown"}</span>
          <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
            {ATTR_LABELS.map(({ key, label: attrLabel }) => (
              <span key={key} className="text-white text-xs opacity-80">
                {attrLabel}: <span className="text-yellow-300">{slot.attributes[key]}</span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <span className="text-white text-xs opacity-40 italic self-center">Empty</span>
      )}
    </InnerPanel>
  );
}

/** Equipped-items list, driven by the live game store. */
export function GearPanel() {
  const equipment = useGameStore((s) => s.state.equipment ?? INITIAL_EQUIPMENT);

  return (
    <>
      <SectionLabel icon="/assets/icons/heart.png">Gear</SectionLabel>
      <div className="flex flex-col gap-2">
        {SLOT_ORDER.map((slotName) => (
          <GearSlotRow key={slotName} slotName={slotName} slot={equipment[slotName]} />
        ))}
      </div>
    </>
  );
}

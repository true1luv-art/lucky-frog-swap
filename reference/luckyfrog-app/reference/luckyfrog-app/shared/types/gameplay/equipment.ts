// §C5 — Canonical equipment slots: weapon | armor | mount | accessory | special.
// `avatar` has been removed; `special` is added for unique/seasonal items.
// Equipment attributes mirror the six frog/core stats. Stats are not yet
// implemented in gameplay, so these are placeholders that can change later.

export type EquipmentAttributes = {
  dodge:   number;
  damage:  number;
  defense: number;
  mining:  number;
  crit:    number;
  luck:    number;
};

export type EquipmentSlotName = "weapon" | "armor" | "mount" | "accessory" | "special";

export type EquipmentSlot = {
  item_number:   number | null;
  item_id:       string | null;
  item_equipped: boolean;
  attributes:    EquipmentAttributes;
};

export type PlayerEquipment = Record<EquipmentSlotName, EquipmentSlot>;

export const EMPTY_ATTRIBUTES: EquipmentAttributes = {
  dodge: 0, damage: 0, defense: 0, mining: 0, crit: 0, luck: 0,
};

export const INITIAL_BASE_STATS: EquipmentAttributes = {
  damage: 5, defense: 5, crit: 1, dodge: 1, luck: 1, mining: 1,
};

export function computeStats(
  base: EquipmentAttributes,
  equipment: PlayerEquipment,
): EquipmentAttributes {
  const keys = Object.keys(base) as Array<keyof EquipmentAttributes>;
  const result = { ...base };
  for (const slot of Object.values(equipment)) {
    if (!slot.item_equipped) continue;
    for (const key of keys) {
      result[key] = (result[key] ?? 0) + (slot.attributes[key] ?? 0);
    }
  }
  return result;
}

const emptySlot = (): EquipmentSlot => ({
  item_number: null, item_id: null, item_equipped: false,
  attributes: { ...EMPTY_ATTRIBUTES },
});

export const INITIAL_EQUIPMENT: PlayerEquipment = {
  weapon:    emptySlot(),
  armor:     emptySlot(),
  mount:     emptySlot(),
  accessory: emptySlot(),
  special:   emptySlot(),
};

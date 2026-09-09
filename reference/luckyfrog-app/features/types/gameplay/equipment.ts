/**
 * features/types/gameplay/equipment.ts
 *
 * RPG equipment layer — tiers, slots, rolled stats, and the starter set.
 *
 * NOTE (this iteration): equipment stats are DISPLAY-ONLY. They are rolled,
 * stored, upgraded, and shown in the UI, but do NOT yet modify gathering or
 * combat outcomes.
 */

/**
 * Armor material tiers, ordered weakest → strongest.
 * Stone has been removed — only ore-based ingots exist above Wood.
 */
export type EquipmentTier =
  | "Wood"
  | "Iron"
  | "Silver"
  | "Emerald"
  | "Diamond"
  | "Ignisite";

/** Craftable armor slots (each rolls random stats per tier). */
export type EquipmentSlot = "Helm" | "Armor" | "Pants" | "Boots";

/** Stat names that can appear on a piece of equipment. */
export type EquipmentStatName =
  | "Attack"
  | "Defense"
  | "Luck"
  | "Speed"
  | "Crit";

/** A partial map of stat name → value (flat for Attack/Defense, % for the rest). */
export type EquipmentStats = Partial<Record<EquipmentStatName, number>>;

/** A single owned/equipped piece of equipment. */
export type EquipmentItem = {
  /** Stable unique id (nanoid-style string). */
  id: string;
  tier: EquipmentTier;
  slot: EquipmentSlot;
  /** Rolled stats. Higher tiers roll more stats and higher magnitudes. */
  stats: EquipmentStats;
  /** Number of times upgraded. Each upgrade adds +5% to every existing stat. */
  upgradeLevel: number;
};

/** Equipped pieces keyed by slot. Every slot is always filled (starter set floor). */
export type EquippedSet = Record<EquipmentSlot, EquipmentItem>;

/** Persisted equipment state on GameState. */
export type EquipmentState = {
  equipped: EquippedSet;
  owned: EquipmentItem[];
};

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ["Helm", "Armor", "Pants", "Boots"];

export const EQUIPMENT_STAT_NAMES: EquipmentStatName[] = [
  "Attack",
  "Defense",
  "Luck",
  "Speed",
  "Crit",
];

/**
 * STARTER_SET — Wood-tier pieces every player begins with. Auto-equipped,
 * not craftable, and roll no stats (Wood tier has 0 stats).
 */
export const STARTER_SET: EquippedSet = {
  Helm:  { id: "starter-helm",  tier: "Wood", slot: "Helm",  stats: {}, upgradeLevel: 0 },
  Armor: { id: "starter-armor", tier: "Wood", slot: "Armor", stats: {}, upgradeLevel: 0 },
  Pants: { id: "starter-pants", tier: "Wood", slot: "Pants", stats: {}, upgradeLevel: 0 },
  Boots: { id: "starter-boots", tier: "Wood", slot: "Boots", stats: {}, upgradeLevel: 0 },
};

/** Factory for a fresh starter equipment state (deep-cloned to avoid shared refs). */
export function createInitialEquipment(): EquipmentState {
  return {
    equipped: {
      Helm:  { ...STARTER_SET.Helm,  stats: {} },
      Armor: { ...STARTER_SET.Armor, stats: {} },
      Pants: { ...STARTER_SET.Pants, stats: {} },
      Boots: { ...STARTER_SET.Boots, stats: {} },
    },
    owned: [],
  };
}

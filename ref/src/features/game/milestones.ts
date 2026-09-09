/**
 * shared/game/milestones.ts
 *
 * Single source of truth for:
 *   - The milestone counter tracker functions (trackMilestone, withMilestone, getMilestoneCount)
 *   - The milestone definitions array (MILESTONES)
 *   - Progress reader helpers (getMilestoneProgress, getMilestonesByCategory)
 *
 * Milestones are lifetime counters stored in GameState.milestones (persisted to
 * farms.milestones in MongoDB).  Each event handler increments the relevant
 * key(s) via trackMilestone().
 */

import type { GameState } from "@/features/types/gameplay/game";
import type { Milestones, MilestoneName } from "@/features/types/gameplay/milestones";

// ---------------------------------------------------------------------------
// Tracker functions (replaces shared/game/activity.ts)
// ---------------------------------------------------------------------------

/**
 * Returns a new Milestones map with `name` incremented by `amount`.
 * Pure function — does not mutate the input.
 */
export function trackMilestone(
  milestones: Milestones | undefined,
  name: MilestoneName,
  amount: number,
): Milestones {
  const current = milestones?.[name] ?? 0;
  return { ...milestones, [name]: current + amount };
}

/**
 * Convenience wrapper — reads milestones from GameState and returns the
 * updated Milestones map.
 */
export function withMilestone(
  state: GameState,
  name: MilestoneName,
  amount: number = 1,
): Milestones {
  return trackMilestone(state.milestones, name, amount);
}

/**
 * Returns the current count for `name`, or 0 if not yet recorded.
 */
export function getMilestoneCount(
  milestones: Milestones | undefined,
  name: MilestoneName,
): number {
  return milestones?.[name] ?? 0;
}

// ---------------------------------------------------------------------------
// Milestone definition types
// ---------------------------------------------------------------------------

export type MilestoneCategory =
  | "farming"
  | "resources"
  | "animals"
  | "fishing"
  | "cooking"
  | "economy";

export type MilestoneDefinition = {
  /** The MilestoneName key this milestone reads from. */
  key: MilestoneName;
  /** Human-readable display name shown in the UI. */
  label: string;
  /** Category used for grouping in the UI. */
  category: MilestoneCategory;
};

// ---------------------------------------------------------------------------
// Milestone definitions
// ---------------------------------------------------------------------------

export const MILESTONES: MilestoneDefinition[] = [
  // -------------------------------------------------------------------------
  // Farming
  // -------------------------------------------------------------------------
  { key: "Seed Planted",          label: "Seeds Planted",             category: "farming" },
  { key: "Crop Harvested",        label: "Total Crops Harvested",     category: "farming" },
  { key: "Potato Harvested",      label: "Potatoes Harvested",        category: "farming" },
  { key: "Carrot Harvested",      label: "Carrots Harvested",         category: "farming" },
  { key: "Cabbage Harvested",     label: "Cabbages Harvested",        category: "farming" },
  { key: "Pumpkin Harvested",     label: "Pumpkins Harvested",        category: "farming" },
  { key: "Beetroot Harvested",    label: "Beetroots Harvested",       category: "farming" },
  { key: "Parsnip Harvested",     label: "Parsnips Harvested",        category: "farming" },
  { key: "Radish Harvested",      label: "Radishes Harvested",        category: "farming" },
  { key: "Cauliflower Harvested", label: "Cauliflowers Harvested",    category: "farming" },
  { key: "Wheat Harvested",       label: "Wheat Harvested",           category: "farming" },
  { key: "Kale Harvested",        label: "Kale Harvested",            category: "farming" },

  // -------------------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------------------
  { key: "Tree Chopped", label: "Trees Chopped", category: "resources" },
  { key: "Stone Mined",  label: "Stone Mined",   category: "resources" },
  { key: "Iron Mined",   label: "Iron Mined",    category: "resources" },
  { key: "Gold Mined",   label: "Gold Mined",    category: "resources" },

  // -------------------------------------------------------------------------
  // Animals
  // -------------------------------------------------------------------------
  { key: "Animal Fed",     label: "Animals Fed",     category: "animals" },
  { key: "Egg Collected",  label: "Eggs Collected",  category: "animals" },
  { key: "Milk Collected", label: "Milk Collected",  category: "animals" },
  { key: "Wool Collected", label: "Wool Collected",  category: "animals" },

  // -------------------------------------------------------------------------
  // Fishing
  // -------------------------------------------------------------------------
  { key: "Fish Caught",        label: "Total Fish Caught",    category: "fishing" },
  { key: "Anchovy Caught",     label: "Anchovies Caught",     category: "fishing" },
  { key: "Sardine Caught",     label: "Sardines Caught",      category: "fishing" },
  { key: "Tilapia Caught",     label: "Tilapia Caught",       category: "fishing" },
  { key: "Herring Caught",     label: "Herring Caught",       category: "fishing" },
  { key: "Trout Caught",       label: "Trout Caught",         category: "fishing" },
  { key: "Sea Bass Caught",    label: "Sea Bass Caught",      category: "fishing" },
  { key: "Mackerel Caught",    label: "Mackerel Caught",      category: "fishing" },
  { key: "Salmon Caught",      label: "Salmon Caught",        category: "fishing" },
  { key: "Red Snapper Caught", label: "Red Snapper Caught",   category: "fishing" },
  { key: "Barracuda Caught",   label: "Barracuda Caught",     category: "fishing" },
  { key: "Tuna Caught",        label: "Tuna Caught",          category: "fishing" },
  { key: "Swordfish Caught",   label: "Swordfish Caught",     category: "fishing" },
  { key: "Blue Marlin Caught", label: "Blue Marlin Caught",   category: "fishing" },
  { key: "Oarfish Caught",     label: "Oarfish Caught",       category: "fishing" },

  // -------------------------------------------------------------------------
  // Cooking
  // -------------------------------------------------------------------------
  { key: "Food Cooked",                 label: "Total Food Cooked",             category: "cooking" },
  { key: "Roasted Potato Cooked",       label: "Roasted Potatoes Cooked",       category: "cooking" },
  { key: "Carrot Stew Cooked",          label: "Carrot Stews Cooked",           category: "cooking" },
  { key: "Cabbage Roll Cooked",         label: "Cabbage Rolls Cooked",          category: "cooking" },
  { key: "Pumpkin Soup Cooked",         label: "Pumpkin Soups Cooked",          category: "cooking" },
  { key: "Beetroot Salad Cooked",       label: "Beetroot Salads Cooked",        category: "cooking" },
  { key: "Parsnip Porridge Cooked",     label: "Parsnip Porridges Cooked",      category: "cooking" },
  { key: "Radish Skewers Cooked",       label: "Radish Skewers Cooked",         category: "cooking" },
  { key: "Cauliflower Sandwich Cooked", label: "Cauliflower Sandwiches Cooked", category: "cooking" },
  { key: "Wheat Bread Cooked",          label: "Wheat Breads Cooked",           category: "cooking" },
  { key: "Kale Stir-fry Cooked",        label: "Kale Stir-fries Cooked",        category: "cooking" },

  // -------------------------------------------------------------------------
  // Economy
  // -------------------------------------------------------------------------
  { key: "Coins Earned",    label: "Total Coins Earned",    category: "economy" },
  { key: "Coins Spent",     label: "Total Coins Spent",     category: "economy" },
  { key: "Coins Deposited", label: "Total Coins Deposited", category: "economy" },
  { key: "Coins Withdrawn", label: "Total Coins Withdrawn", category: "economy" },
  { key: "Coins Burned",    label: "Total Coins Burned",    category: "economy" },
];

// ---------------------------------------------------------------------------
// Progress reader
// ---------------------------------------------------------------------------

export type MilestoneProgress = {
  definition: MilestoneDefinition;
  count: number;
};

/**
 * Returns the current count for every milestone, derived from the player's
 * milestones map.  Keys not yet present default to 0.
 * Pure function — no side effects, no DB access.
 */
export function getMilestoneProgress(milestones: Milestones | undefined): MilestoneProgress[] {
  return MILESTONES.map((definition) => ({
    definition,
    count: milestones?.[definition.key] ?? 0,
  }));
}

/**
 * Returns milestones filtered to a single category.
 */
export function getMilestonesByCategory(
  milestones: Milestones | undefined,
  category: MilestoneCategory,
): MilestoneProgress[] {
  return getMilestoneProgress(milestones).filter(
    (m) => m.definition.category === category,
  );
}

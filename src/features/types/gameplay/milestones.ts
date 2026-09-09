/**
 * shared/types/gameplay/milestones.ts
 *
 * MilestoneName — the complete union of all lifetime counter keys stored in
 * GameState.milestones.  Each event handler increments the relevant key(s) via
 * trackMilestone() in shared/game/milestones.ts.
 *
 * Naming convention:
 *   "<Item> <Past-tense verb>"   e.g. "Potato Harvested", "Anchovy Caught"
 *   Aggregate keys use a category noun:  "Crop Harvested", "Fish Caught", "Food Cooked"
 */

export type MilestoneName =
  // -------------------------------------------------------------------------
  // Farming — harvesting
  // -------------------------------------------------------------------------
  | "Crop Harvested"
  | "Potato Harvested"
  | "Carrot Harvested"
  | "Cabbage Harvested"
  | "Pumpkin Harvested"
  | "Beetroot Harvested"
  | "Parsnip Harvested"
  | "Radish Harvested"
  | "Cauliflower Harvested"
  | "Wheat Harvested"
  | "Kale Harvested"

  // -------------------------------------------------------------------------
  // Farming — planting
  // -------------------------------------------------------------------------
  | "Seed Planted"

  // -------------------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------------------
  | "Tree Chopped"
  | "Stone Mined"
  | "Iron Mined"
  | "Gold Mined"

  // -------------------------------------------------------------------------
  // Animals
  // -------------------------------------------------------------------------
  | "Animal Fed"
  | "Egg Collected"
  | "Milk Collected"
  | "Wool Collected"

  // -------------------------------------------------------------------------
  // Fishing
  // -------------------------------------------------------------------------
  | "Fish Caught"
  | "Anchovy Caught"
  | "Sardine Caught"
  | "Tilapia Caught"
  | "Herring Caught"
  | "Trout Caught"
  | "Sea Bass Caught"
  | "Mackerel Caught"
  | "Salmon Caught"
  | "Red Snapper Caught"
  | "Barracuda Caught"
  | "Tuna Caught"
  | "Swordfish Caught"
  | "Blue Marlin Caught"
  | "Oarfish Caught"

  // -------------------------------------------------------------------------
  // Cooking
  // -------------------------------------------------------------------------
  | "Food Cooked"
  | "Roasted Potato Cooked"
  | "Carrot Stew Cooked"
  | "Cabbage Roll Cooked"
  | "Pumpkin Soup Cooked"
  | "Beetroot Salad Cooked"
  | "Parsnip Porridge Cooked"
  | "Radish Skewers Cooked"
  | "Cauliflower Sandwich Cooked"
  | "Wheat Bread Cooked"
  | "Kale Stir-fry Cooked"

  // -------------------------------------------------------------------------
  // Economy
  // -------------------------------------------------------------------------
  | "Coins Earned"
  | "Coins Spent"
  | "Coins Deposited"
  | "Coins Withdrawn"
  | "Coins Burned";

export type Milestones = Partial<Record<MilestoneName, number>>;

import Decimal from "decimal.js-light";
import { SeedName, SEEDS } from "@/features/types/gameplay/crops";
import { InventoryItemName } from "@/features/types/gameplay/game";

/**
 * Action dispatched when the player buys a seed or animal from the shop.
 */
export type PurchaseAction = {
  type: "item.crafted";
  item: InventoryItemName;
  amount: number;
};

/** @deprecated Use PurchaseAction instead */
export type CraftAction = PurchaseAction;

/**
 * Returns the effective buy price of a purchasable item (coin-priced items only).
 * Seeds no longer have a coin price — this returns 0 for them.
 */
export function getBuyPrice(item: { price?: Decimal }, _inventory?: unknown): Decimal {
  return item.price ?? new Decimal(0);
}

// ── Tools ────────────────────────────────────────────────────────────────────
// ToolName and ToolTier now live in features/types/gameplay/tools.ts.
// This re-export keeps backwards compatibility for callers that imported ToolName
// from craftables.ts.

export type { ToolName, ToolTier } from "@/features/types/gameplay/tools";
import type { ToolName } from "@/features/types/gameplay/tools";

export interface ToolDetails {
  name: ToolName;
  description: string;
  /**
   * No longer a coin cost — tools are crafted with ingots (see TOOL_CRAFT_RECIPES
   * in tools.ts). This field is kept for UI backwards compatibility.
   */
  price: number;
  /** True for Wood-tier tools: free to craft, max 1 owned. */
  isWoodTool?: boolean;
  /** Max owned at once. Enforced server-side. Undefined = no cap. */
  maxOwned?: number;
}

export const TOOLS: () => Record<ToolName, ToolDetails> = () => ({
  Axe: {
    name: "Axe",
    description: "Used to chop trees. Wood tier is free and never breaks. Ore-tier axes have durability and a speed boost.",
    price: 0,
    isWoodTool: true,
    maxOwned: 1,
  },
  Pickaxe: {
    name: "Pickaxe",
    description: "Used to mine stone and ore. Wood tier is free and never breaks. Ore-tier pickaxes have durability and a speed boost.",
    price: 0,
    isWoodTool: true,
    maxOwned: 1,
  },
  Rod: {
    name: "Rod",
    description: "Used to catch fish. Wood tier is free and never breaks. Ore-tier rods have durability and a speed boost.",
    price: 0,
    isWoodTool: true,
    maxOwned: 1,
  },
  "Watering Can": {
    name: "Watering Can",
    description: "Required to water planted crops. Crops only begin growing after watering. Ore-tier cans have durability and reduce crop growth time.",
    price: 0,
    isWoodTool: true,
    maxOwned: 1,
  },
});

export type CraftableName = SeedName | Food | Animal;

export type Craftable = {
  name: CraftableName;
  description: string;
  price?: Decimal;
  ingredients: { item: InventoryItemName; amount: Decimal }[];
  limit?: number;
  supply?: number;
  disabled?: boolean;
  /** Minimum farm level required to purchase (animals) or craft (seeds via farming skill level). */
  farmLevelRequirement?: number;
};

/**
 * Food names — 8 total.
 * "Baked Potato" and "Cooked Fish" are always available (free defaults).
 * The other 6 require a one-time Gold unlock at the Kitchen.
 */
export type Food =
  | "Baked Potato"
  | "Cooked Fish"
  | "Cabbage Roll"
  | "Carrot Stew"
  | "Pumpkin Soup"
  | "Scrambled Eggs"
  | "Wheat Bread"
  | "Pumpkin Pie";

export type Animal = "Chicken" | "Cow" | "Sheep";

/**
 * FOODS — cooking recipes.
 *
 * Every recipe implicitly requires 1x Wood as fuel (deducted at cook time
 * in cookFood.ts and serverCookFood). The Wood cost is NOT listed in
 * `ingredients` here — it is always appended by the cook event.
 *
 * Ingredient lists shown are the food-specific inputs only.
 */
export const FOODS: () => Record<Food, Craftable> = () => ({
  "Baked Potato": {
    name: "Baked Potato",
    description: "Warm and simple. Restores 20 stamina.",
    ingredients: [
      { item: "Potato", amount: new Decimal(2) },
    ],
  },
  "Cooked Fish": {
    name: "Cooked Fish",
    description: "Lightly grilled fish. Restores 10 stamina.",
    ingredients: [
      { item: "Fish", amount: new Decimal(1) },
    ],
  },
  "Cabbage Roll": {
    name: "Cabbage Roll",
    description: "Savory wrapped delight. Restores 25 stamina.",
    ingredients: [
      { item: "Cabbage", amount: new Decimal(2) },
      { item: "Carrot",  amount: new Decimal(1) },
    ],
  },
  "Carrot Stew": {
    name: "Carrot Stew",
    description: "Hearty stew. Restores 30 stamina.",
    ingredients: [
      { item: "Carrot", amount: new Decimal(3) },
    ],
  },
  "Pumpkin Soup": {
    name: "Pumpkin Soup",
    description: "Creamy autumn flavor. Restores 40 stamina.",
    ingredients: [
      { item: "Pumpkin", amount: new Decimal(3) },
      { item: "Cabbage", amount: new Decimal(1) },
    ],
  },
  "Scrambled Eggs": {
    name: "Scrambled Eggs",
    description: "Fluffy eggs. Restores 35 stamina.",
    ingredients: [
      { item: "Egg", amount: new Decimal(3) },
    ],
  },
  "Wheat Bread": {
    name: "Wheat Bread",
    description: "Fresh baked loaf. Restores 50 stamina.",
    ingredients: [
      { item: "Wheat", amount: new Decimal(5) },
      { item: "Milk",  amount: new Decimal(1) },
    ],
  },
  "Pumpkin Pie": {
    name: "Pumpkin Pie",
    description: "Sweet and golden. Restores 60 stamina.",
    ingredients: [
      { item: "Pumpkin", amount: new Decimal(3) },
      { item: "Egg",     amount: new Decimal(2) },
      { item: "Milk",    amount: new Decimal(1) },
    ],
  },
});

/**
 * Stamina restored when a food is eaten.
 *
 * | Food           | Stamina |
 * |----------------|---------|
 * | Baked Potato   |  20     |
 * | Cooked Fish    |  10     |
 * | Cabbage Roll   |  25     |
 * | Carrot Stew    |  30     |
 * | Pumpkin Soup   |  40     |
 * | Scrambled Eggs |  35     |
 * | Wheat Bread    |  50     |
 * | Pumpkin Pie    |  60     |
 */
export const FOOD_EFFECTS: Record<Food, { stamina: number }> = {
  "Baked Potato":   { stamina: 20 },
  "Cooked Fish":    { stamina: 10 },
  "Cabbage Roll":   { stamina: 25 },
  "Carrot Stew":    { stamina: 30 },
  "Pumpkin Soup":   { stamina: 40 },
  "Scrambled Eggs": { stamina: 35 },
  "Wheat Bread":    { stamina: 50 },
  "Pumpkin Pie":    { stamina: 60 },
};

/**
 * Minimum Farm Level required to cook each recipe.
 * Replaces the old Gold-based FOOD_UNLOCK_COST system.
 */
export const FOOD_FARM_LEVEL_REQUIREMENT: Record<Food, number> = {
  "Baked Potato":   1,
  "Cooked Fish":    1,
  "Cabbage Roll":   2,
  "Carrot Stew":    2,
  "Pumpkin Soup":   4,
  "Scrambled Eggs": 4,
  "Wheat Bread":    7,
  "Pumpkin Pie":    6,
};

/**
 * ANIMALS — purchased with Gold.
 * Chicken eats Carrot (1x). Cow and Sheep both eat Wheat (1x).
 *
 * | Animal  | Gold | Eats  | Produces |
 * |---------|------|-------|----------|
 * | Chicken | 10   | Carrot| Egg      |
 * | Cow     | 40   | Wheat | Milk     |
 * | Sheep   | 25   | Wheat | Wool     |
 */
export const ANIMALS: Record<Animal, Craftable> = {
  Chicken: {
    name: "Chicken",
    description: "Produces eggs. Eats Carrot.",
    price: new Decimal(10),
    ingredients: [],
    farmLevelRequirement: 2,
  },
  Cow: {
    name: "Cow",
    description: "Produces milk. Eats Wheat.",
    price: new Decimal(40),
    ingredients: [],
    farmLevelRequirement: 4,
  },
  Sheep: {
    name: "Sheep",
    description: "Produces wool. Eats Wheat.",
    price: new Decimal(25),
    ingredients: [],
    farmLevelRequirement: 6,
  },
};

export const CRAFTABLES: () => Record<CraftableName, Craftable> = () => ({
  ...SEEDS(),
  ...FOODS(),
  ...ANIMALS,
});

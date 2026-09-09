/**
 * shared/data/farming.ts
 *
 * Isomorphic source of truth for farming constants and pure helpers. §2.1-E
 * This module may be consumed by browser and server packages and therefore
 * must only depend on other shared modules or platform-neutral packages.
 */

// ---------------------------------------------------------------------------
// Crop types
// ---------------------------------------------------------------------------

export type CropName =
  | "Potato"
  | "Carrot"
  | "Cabbage"
  | "Pumpkin"
  | "Beetroot"
  | "Parsnip"
  | "Radish"
  | "Cauliflower"
  | "Wheat"
  | "Kale";

export type SeedName = `${CropName} Seed`;

export interface CropConfig {
  name: CropName;
  /** Growth time in seconds. */
  harvestSeconds: number;
  /** Seed buy price in LFRG (× 1 = coins). Stored as plain number here. */
  buyPrice: number;
  /** Sell price in LFRG when selling directly to the game. */
  sellPrice: number;
  /** Minimum farming skill level required to plant this crop. */
  farmingLevelRequired: number;
  description: string;
}

/**
 * CROPS_CONFIG — server-side crop definitions.
 * Mirrors phaser/game/types/crops.ts CROPS() and SEEDS() exactly. §2.1-E
 */
export const CROPS_CONFIG: Record<CropName, CropConfig> = {
  Potato: {
    name: "Potato",
    harvestSeconds: 60,
    buyPrice: 0.05,
    sellPrice: 0.065,
    farmingLevelRequired: 0,
    description: "Starchy and filling.",
  },
  Carrot: {
    name: "Carrot",
    harvestSeconds: 5 * 60,
    buyPrice: 0.125,
    sellPrice: 0.175,
    farmingLevelRequired: 1,
    description: "Crunchy and sweet.",
  },
  Cabbage: {
    name: "Cabbage",
    harvestSeconds: 10 * 60,
    buyPrice: 0.25,
    sellPrice: 0.375,
    farmingLevelRequired: 2,
    description: "Leafy and fresh.",
  },
  Pumpkin: {
    name: "Pumpkin",
    harvestSeconds: 30 * 60,
    buyPrice: 0.5,
    sellPrice: 0.8,
    farmingLevelRequired: 3,
    description: "Big and orange.",
  },
  Beetroot: {
    name: "Beetroot",
    harvestSeconds: 60 * 60,
    buyPrice: 0.875,
    sellPrice: 1.575,
    farmingLevelRequired: 5,
    description: "Sweet and earthy.",
  },
  Parsnip: {
    name: "Parsnip",
    harvestSeconds: 2 * 60 * 60,
    buyPrice: 1.5,
    sellPrice: 3,
    farmingLevelRequired: 6,
    description: "Pale and sweet.",
  },
  Radish: {
    name: "Radish",
    harvestSeconds: 3 * 60 * 60,
    buyPrice: 2.25,
    sellPrice: 4.95,
    farmingLevelRequired: 8,
    description: "Peppery crunch.",
  },
  Cauliflower: {
    name: "Cauliflower",
    harvestSeconds: 6 * 60 * 60,
    buyPrice: 3.5,
    sellPrice: 8.75,
    farmingLevelRequired: 10,
    description: "White and fluffy.",
  },
  Wheat: {
    name: "Wheat",
    harvestSeconds: 12 * 60 * 60,
    buyPrice: 5,
    sellPrice: 14,
    farmingLevelRequired: 12,
    description: "Golden grain.",
  },
  Kale: {
    name: "Kale",
    harvestSeconds: 24 * 60 * 60,
    buyPrice: 7.5,
    sellPrice: 22.5,
    farmingLevelRequired: 15,
    description: "Super greens.",
  },
};

// ---------------------------------------------------------------------------
// Halving-driven price adjustment
// See docs/halving-price-integration.md §5 Step 1.
// ---------------------------------------------------------------------------

/**
 * Returns a base price scaled by the current halving multiplier.
 *
 * `emissionMultiplier` comes from GET /api/game-stats or the
 * `getHalvingState()` snapshot passed into server-side handlers. Keeping the
 * multiplier as an argument makes this function pure and testable — it has no
 * dependency on MongoDB or the game-stats module.
 *
 * A multiplier of `0` (or any non-finite/negative value) is treated as `1`
 * (Genesis stage) to prevent zero-value items — see §9 Edge Cases.
 *
 * @param basePrice           The stage-0 (Genesis) price for this item.
 * @param emissionMultiplier  Current value from halvingStage (1 | 0.5 | 0.25 | 0.125 | 0.0625).
 */
export function getHalvedPrice(basePrice: number, emissionMultiplier: number): number {
  const safeMultiplier =
    Number.isFinite(emissionMultiplier) && emissionMultiplier > 0
      ? emissionMultiplier
      : 1;
  return basePrice * safeMultiplier;
}

// ---------------------------------------------------------------------------
// Resource node recovery times (seconds)
// ---------------------------------------------------------------------------

/** Tree (Wood) regeneration time. §2.1-E */
export const TREE_RECOVERY_SECONDS = 900;     // 15 minutes

/** Stone rock regeneration time. §2.1-E */
export const STONE_RECOVERY_SECONDS = 3_600;  // 1 hour

/** Iron rock regeneration time. §2.1-E */
export const IRON_RECOVERY_SECONDS = 43_200;  // 12 hours

/** Gold rock regeneration time. §2.1-E */
export const GOLD_RECOVERY_SECONDS = 86_400;  // 24 hours

// ---------------------------------------------------------------------------
// Stamina
// ---------------------------------------------------------------------------

/**
 * STAMINA_CONFIG — matches phaser/game/lib/stamina.ts STAMINA_CONSTANTS. §2.1-E
 */
export const STAMINA_CONFIG = {
  /** Maximum stamina for a player (no level scaling in Phase 2). */
  max: 100,
  /** Fraction of max stamina restored per regen interval. */
  regenPercent: 0.05,
  /** How often stamina regenerates (ms). */
  regenIntervalMs: 60 * 60 * 1000,   // 1 hour
  /** Maximum number of offline regen intervals credited on login. */
  maxOfflineIntervals: 8,
} as const;

/**
 * STAMINA_COSTS — action → stamina cost.
 * Mirrors phaser/game/lib/stamina.ts STAMINA_COSTS. §2.1-E
 */
export const STAMINA_COSTS = {
  harvest_crop:     1,
  harvest_resource: 1,
  chop_tree:        1,
  mine_stone:       1,
  mine_iron:        1,
  mine_gold:        1,
  plant:            0,
  fish_cast:        3,
} as const;

export type StaminaActionKey = keyof typeof STAMINA_COSTS;

// ---------------------------------------------------------------------------
// Animal types
// ---------------------------------------------------------------------------

export type AnimalType = "Chicken" | "Cow" | "Sheep";

export interface AnimalConfig {
  type: AnimalType;
  /** Item consumed when feeding the animal. */
  feedItem: string;
  /** Item produced after a successful produce cycle. */
  produceItem: string;
  /** Time from feeding → produce ready (ms). */
  produceTimeMs: number;
  /** Cooldown before the animal is hungry again (ms). */
  reHungerDelayMs: number;
  /** Maximum allowed count of this animal on the farm. */
  maxCount: number;
  /** Buy price in LFRG. */
  price: number;
  /** Minimum farming level required to purchase. */
  farmingLevelRequired: number;
  /** Sell price of the produced item. */
  produceSellPrice: number;
}

/**
 * ANIMALS_CONFIG — server-side animal definitions.
 * Timing values from phaser/game/lib/constants.ts. §2.1-E
 */
export const ANIMALS_CONFIG: Record<AnimalType, AnimalConfig> = {
  Chicken: {
    type: "Chicken",
    feedItem: "Wheat",
    produceItem: "Egg",
    produceTimeMs: 60 * 1_000,          // 1 minute (Phaser: CHICKEN_TIME_TO_EGG)
    reHungerDelayMs: 4 * 60 * 60 * 1_000, // 4 hours (Phaser: CHICKEN_RE_HUNGER_DELAY)
    maxCount: 10,
    price: 5,
    farmingLevelRequired: 3,
    produceSellPrice: 0.08,
  },
  Cow: {
    type: "Cow",
    feedItem: "Kale",
    produceItem: "Milk",
    produceTimeMs: 90 * 1_000,           // 1.5 minutes (Phaser: COW_TIME_TO_MILK)
    reHungerDelayMs: 6 * 60 * 60 * 1_000, // 6 hours (Phaser: COW_RE_HUNGER_DELAY)
    maxCount: 5,
    price: 50,
    farmingLevelRequired: 6,
    produceSellPrice: 1.5,
  },
  Sheep: {
    type: "Sheep",
    feedItem: "Cabbage",
    produceItem: "Wool",
    produceTimeMs: 120 * 1_000,           // 2 minutes (Phaser: SHEEP_TIME_TO_WOOL)
    reHungerDelayMs: 6 * 60 * 60 * 1_000, // 6 hours (Phaser: SHEEP_RE_HUNGER_DELAY)
    maxCount: 5,
    price: 30,
    farmingLevelRequired: 8,
    produceSellPrice: 0.9,
  },
};

// ---------------------------------------------------------------------------
// Fishing
// ---------------------------------------------------------------------------

export type FishName =
  | "Anchovy" | "Sardine" | "Tilapia" | "Herring"
  | "Trout" | "Sea Bass" | "Mackerel" | "Salmon"
  | "Red Snapper" | "Barracuda" | "Tuna" | "Swordfish"
  | "Blue Marlin" | "Oarfish";

export interface FishEntry {
  name: FishName;
  /** Weighted random draw weight. Higher = more common. */
  weight: number;
  /** Minimum fishing skill level required. */
  minLevel: number;
  /** Sell price in LFRG when selling directly. */
  sellPrice: number;
}

/**
 * FISH_TABLE — mirrors phaser/game/lib/fishing.ts FISH_TABLE exactly. §2.1-E
 */
export const FISH_TABLE: FishEntry[] = [
  { name: "Anchovy",      weight: 50,  minLevel: 0,  sellPrice: 0.30  },
  { name: "Sardine",      weight: 45,  minLevel: 0,  sellPrice: 0.35  },
  { name: "Tilapia",      weight: 40,  minLevel: 0,  sellPrice: 0.40  },
  { name: "Herring",      weight: 35,  minLevel: 0,  sellPrice: 0.45  },
  { name: "Trout",        weight: 28,  minLevel: 10, sellPrice: 0.60  },
  { name: "Sea Bass",     weight: 22,  minLevel: 10, sellPrice: 0.80  },
  { name: "Mackerel",     weight: 18,  minLevel: 20, sellPrice: 1.00  },
  { name: "Salmon",       weight: 15,  minLevel: 20, sellPrice: 1.20  },
  { name: "Red Snapper",  weight: 10,  minLevel: 30, sellPrice: 1.80  },
  { name: "Barracuda",    weight: 7,   minLevel: 40, sellPrice: 2.50  },
  { name: "Tuna",         weight: 5,   minLevel: 50, sellPrice: 3.50  },
  { name: "Swordfish",    weight: 3,   minLevel: 60, sellPrice: 5.00  },
  { name: "Blue Marlin",  weight: 1.5, minLevel: 70, sellPrice: 8.00  },
  { name: "Oarfish",      weight: 0.5, minLevel: 90, sellPrice: 15.00 },
];

/** Base fishing cooldown before skill bonuses (ms). Phaser: FISHING_BASE_COOLDOWN_MS */
export const FISHING_BASE_COOLDOWN_MS = 30_000;

/** Minimum fishing cooldown with all bonuses applied (ms). Phaser: FISHING_MIN_COOLDOWN_MS */
export const FISHING_MIN_COOLDOWN_MS = 15_000;

// ---------------------------------------------------------------------------
// Foods (cooking)
// ---------------------------------------------------------------------------

export type FoodName =
  | "Roasted Potato"
  | "Carrot Stew"
  | "Cabbage Roll"
  | "Pumpkin Soup"
  | "Beetroot Salad"
  | "Parsnip Porridge"
  | "Radish Skewers"
  | "Cauliflower Sandwich"
  | "Wheat Bread"
  | "Kale Stir-fry";

export interface FoodIngredient {
  item: string;
  amount: number;
}

export interface FoodConfig {
  name: FoodName;
  description: string;
  /** Cook time in seconds. */
  cookTimeSeconds: number;
  /** Sell price in LFRG when selling to the game. */
  sellPrice: number;
  ingredients: FoodIngredient[];
}

/**
 * FOODS_CONFIG — server-side food / cooking definitions.
 * Mirrors phaser/game/types/craftables.ts FOODS() exactly. §2.1-E
 */
export const FOODS_CONFIG: Record<FoodName, FoodConfig> = {
  "Roasted Potato": {
    name: "Roasted Potato", description: "Warm and crispy.", cookTimeSeconds: 30, sellPrice: 0.09,
    ingredients: [{ item: "Potato", amount: 2 }],
  },
  "Carrot Stew": {
    name: "Carrot Stew", description: "Hearty and filling.", cookTimeSeconds: 60, sellPrice: 0.45,
    ingredients: [{ item: "Carrot", amount: 3 }],
  },
  "Cabbage Roll": {
    name: "Cabbage Roll", description: "Savory wrapped delight.", cookTimeSeconds: 90, sellPrice: 0.90,
    ingredients: [{ item: "Cabbage", amount: 2 }, { item: "Carrot", amount: 1 }],
  },
  "Pumpkin Soup": {
    name: "Pumpkin Soup", description: "Creamy autumn flavor.", cookTimeSeconds: 120, sellPrice: 1.80,
    ingredients: [{ item: "Pumpkin", amount: 3 }, { item: "Cabbage", amount: 1 }],
  },
  "Beetroot Salad": {
    name: "Beetroot Salad", description: "Fresh and tangy.", cookTimeSeconds: 180, sellPrice: 4.70,
    ingredients: [{ item: "Beetroot", amount: 3 }, { item: "Pumpkin", amount: 1 }],
  },
  "Parsnip Porridge": {
    name: "Parsnip Porridge", description: "Warm and creamy.", cookTimeSeconds: 240, sellPrice: 8.10,
    ingredients: [{ item: "Parsnip", amount: 3 }, { item: "Beetroot", amount: 2 }],
  },
  "Radish Skewers": {
    name: "Radish Skewers", description: "Crispy and seasoned.", cookTimeSeconds: 300, sellPrice: 16.20,
    ingredients: [{ item: "Radish", amount: 4 }, { item: "Parsnip", amount: 1 }],
  },
  "Cauliflower Sandwich": {
    name: "Cauliflower Sandwich", description: "Hearty veggie bite.", cookTimeSeconds: 360, sellPrice: 25.20,
    ingredients: [{ item: "Cauliflower", amount: 4 }, { item: "Radish", amount: 2 }],
  },
  "Wheat Bread": {
    name: "Wheat Bread", description: "Fresh baked loaf.", cookTimeSeconds: 420, sellPrice: 45.00,
    ingredients: [{ item: "Wheat", amount: 5 }, { item: "Cauliflower", amount: 2 }],
  },
  "Kale Stir-fry": {
    name: "Kale Stir-fry", description: "Savory greens dish.", cookTimeSeconds: 480, sellPrice: 90.00,
    ingredients: [{ item: "Kale", amount: 5 }, { item: "Wheat", amount: 3 }],
  },
};

// ---------------------------------------------------------------------------
// Field unlock requirements
// §2.3-E — server enforces these; client cannot bypass them.
// ---------------------------------------------------------------------------

/**
 * FIELD_LEVEL_REQUIREMENTS — fieldIndex → minimum farming skill level.
 * Must stay in sync with phaser/game/lib/experience.ts FIELD_LEVEL_REQUIREMENTS. §2.3-E
 *
 * 72 plots (fieldIndex 0–71), 12 rows of 6. Unlock ramps from level 0 up to
 * level 25 — the final row unlocks at level 25, so ALL plots are available once
 * the player reaches Farming Level 25.
 */
export const FIELD_LEVEL_REQUIREMENTS: Record<number, number> = {
  0: 0,   1: 0,   2: 0,   3: 0,   4: 0,   5: 0,   // row 1  — always unlocked
  6: 2,   7: 2,   8: 2,   9: 2,   10: 2,  11: 2,  // row 2  — level 2
  12: 4,  13: 4,  14: 4,  15: 4,  16: 4,  17: 4,  // row 3  — level 4
  18: 6,  19: 6,  20: 6,  21: 6,  22: 6,  23: 6,  // row 4  — level 6
  24: 8,  25: 8,  26: 8,  27: 8,  28: 8,  29: 8,  // row 5  — level 8
  30: 10, 31: 10, 32: 10, 33: 10, 34: 10, 35: 10, // row 6  — level 10
  36: 12, 37: 12, 38: 12, 39: 12, 40: 12, 41: 12, // row 7  — level 12
  42: 14, 43: 14, 44: 14, 45: 14, 46: 14, 47: 14, // row 8  — level 14
  48: 16, 49: 16, 50: 16, 51: 16, 52: 16, 53: 16, // row 9  — level 16
  54: 18, 55: 18, 56: 18, 57: 18, 58: 18, 59: 18, // row 10 — level 18
  60: 21, 61: 21, 62: 21, 63: 21, 64: 21, 65: 21, // row 11 — level 21
  66: 25, 67: 25, 68: 25, 69: 25, 70: 25, 71: 25, // row 12 — level 25
};

/**
 * Returns the minimum farming skill level required to use field `fieldIndex`.
 * Defaults to 0 if the index is not in the table (i.e. always unlocked). §2.3-E
 */
export function getFieldLevelRequirement(fieldIndex: number): number {
  return FIELD_LEVEL_REQUIREMENTS[fieldIndex] ?? 0;
}

/**
 * Returns true when the player's farming skill level meets the requirement for
 * `fieldIndex`. §2.3-E
 */
export function isFieldUnlocked(fieldIndex: number, farmingLevel: number): boolean {
  return farmingLevel >= getFieldLevelRequirement(fieldIndex);
}

// ---------------------------------------------------------------------------
// Skill level formula
// ---------------------------------------------------------------------------

const BASE_LEVEL_XP = 500;

/**
 * Returns the XP required to advance FROM `level` to `level + 1`.
 * Mirrors phaser/game/lib/experience.ts experienceForNextLevel(). §2.1-C
 */
export function experienceForNextLevel(level: number): number {
  return Math.round(BASE_LEVEL_XP + 350 * (level - 1) + 25 * (level - 1) * (level - 1));
}

/**
 * Returns the skill level for a given cumulative XP total.
 * Level starts at 1. Mirrors phaser/game/lib/experience.ts getLevelFromExperience(). §2.1-C
 */
export function getSkillLevel(totalXP: number): number {
  let level = 1;
  let xpNeeded = 0;
  while (xpNeeded <= totalXP) {
    xpNeeded += experienceForNextLevel(level);
    if (xpNeeded <= totalXP) level++;
  }
  return level;
}

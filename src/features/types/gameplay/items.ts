/**
 * features/types/gameplay/items.ts
 *
 * Classifies every stackable `InventoryItemName` with an `ItemType`.
 * The `items` collection (formerly `inventory`) is a flat
 * Partial<Record<InventoryItemName, Decimal>> — this file adds the missing
 * metadata layer so UI, filters, and events can reason about item categories.
 */

export type ItemType =
  | "resource"   // Wood, Stone, Coal
  | "ore"        // Iron, Silver, Emerald, Diamond, Ignisite
  | "ingot"      // Iron Ingot … Ignisite Ingot
  | "crop"       // Potato, Carrot, Cabbage, Pumpkin, Wheat
  | "seed"       // Potato Seed … Wheat Seed
  | "food"       // Baked Potato, Cooked Fish, Carrot Stew, …
  | "fish"       // Fish
  | "animal"     // Egg, Milk, Wool, Chicken, Cow, Sheep
  | "currency"   // Gold
  | "shard";     // Shard — earned by destroying Iron+ armors

// Imported lazily to avoid circular deps — the type is declared here and the
// lookup below is keyed by the same string literals as InventoryItemName.
export const ITEM_TYPE: Record<string, ItemType> = {
  // Resources
  Wood:             "resource",
  Stone:            "resource",
  Coal:             "resource",

  // Ores
  Iron:             "ore",
  Silver:           "ore",
  Emerald:          "ore",
  Diamond:          "ore",
  Ignisite:         "ore",

  // Ingots
  "Iron Ingot":     "ingot",
  "Silver Ingot":   "ingot",
  "Emerald Ingot":  "ingot",
  "Diamond Ingot":  "ingot",
  "Ignisite Ingot": "ingot",

  // Crops
  Potato:           "crop",
  Carrot:           "crop",
  Cabbage:          "crop",
  Pumpkin:          "crop",
  Wheat:            "crop",

  // Seeds
  "Potato Seed":    "seed",
  "Carrot Seed":    "seed",
  "Cabbage Seed":   "seed",
  "Pumpkin Seed":   "seed",
  "Wheat Seed":     "seed",

  // Food
  "Baked Potato":   "food",
  "Cooked Fish":    "food",
  "Cabbage Roll":   "food",
  "Carrot Stew":    "food",
  "Pumpkin Soup":   "food",
  "Scrambled Eggs": "food",
  "Wheat Bread":    "food",
  "Pumpkin Pie":    "food",

  // Fish
  Fish:             "fish",

  // Animals & produce
  Egg:              "animal",
  Milk:             "animal",
  Wool:             "animal",
  Chicken:          "animal",
  Cow:              "animal",
  Sheep:            "animal",

  // Currency
  Gold:             "currency",

  // Shard
  Shard:            "shard",
};

/**
 * lib/events/list-asset/item-asset-type.ts
 *
 * Maps a canonical inventory item name to its GDD §9.3 TradableAssetType.
 *
 * Extracted into its own module so both the listing action (list-stackable.ts)
 * and the embedded-`market` query layer (query.server.ts) can share it without
 * a circular import. §Phase 3
 */

import type { TradableAssetType } from "@/shared/types/marketplace";

/**
 * Maps a canonical item name to its GDD §9.3 TradableAssetType.
 * Defaults to "resource" for unknown items so they are always tradeable.
 */
const ITEM_ASSET_TYPE_MAP: Record<string, TradableAssetType> = {
  // Seeds
  "Potato Seed":     "seed",
  "Carrot Seed":     "seed",
  "Wheat Seed":      "seed",
  "Kale Seed":       "seed",
  "Cabbage Seed":    "seed",
  "Melon Seed":      "seed",
  "Sunflower Seed":  "seed",
  "Pumpkin Seed":    "seed",
  "Beetroot Seed":   "seed",
  "Parsnip Seed":    "seed",
  "Radish Seed":     "seed",
  "Artichoke Seed":  "seed",
  "Onion Seed":      "seed",
  "Blueberry Seed":  "seed",
  "Orange Seed":     "seed",
  "Apple Seed":      "seed",
  "Banana Seed":     "seed",
  "Lemon Seed":      "seed",
  "Tomato Seed":     "seed",
  "Corn Seed":       "seed",
  "Squash Seed":     "seed",
  "Eggplant Seed":   "seed",
  // Food / produce
  Potato:     "food",
  Carrot:     "food",
  Wheat:      "food",
  Kale:       "food",
  Cabbage:    "food",
  Melon:      "food",
  Sunflower:  "food",
  Pumpkin:    "food",
  Beetroot:   "food",
  Parsnip:    "food",
  Radish:     "food",
  Artichoke:  "food",
  Onion:      "food",
  Blueberry:  "food",
  Orange:     "food",
  Apple:      "food",
  Banana:     "food",
  Lemon:      "food",
  Tomato:     "food",
  Corn:       "food",
  Squash:     "food",
  Eggplant:   "food",
  Egg:        "food",
  Wool:       "resource",
  Milk:       "food",
  // Fish
  "Salmon":    "fish",
  "Tuna":      "fish",
  "Carp":      "fish",
  "Anchovy":   "fish",
  "Bass":      "fish",
  "Catfish":   "fish",
  "Trout":     "fish",
  "Blowfish":  "fish",
  "Octopus":   "fish",
  "Squid":     "fish",
  // Economy token — canonical inventory key (§C7). Frogments under `frogment`.
  frogment:  "frogment",
  Frogment:  "frogment",
  Frogments: "frogment",
  // Resources / mining
  Wood:             "resource",
  Stone:            "resource",
  "Iron Ore":       "resource",
  "Gold Ore":       "resource",
  Coal:             "resource",
  "Stone Block":    "crafting_material",
  "Refined Wood":   "crafting_material",
};

export function getItemAssetType(itemName: string): TradableAssetType {
  return ITEM_ASSET_TYPE_MAP[itemName] ?? "resource";
}

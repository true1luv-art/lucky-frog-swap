/**
 * features/game/sell-prices.ts
 *
 * Canonical sell prices for all sellable items.
 * Resources sell for coins at the Market.
 * Crops sell for coins at the Market.
 * Food sells for coins at the Market (higher value than raw crops).
 *
 * These prices are used by both the server route and client-side sell events
 * to keep optimistic UI and server validation in sync.
 */

import type { CropName } from "@/features/types/gameplay/crops";
import type { Food } from "@/features/types/gameplay/craftables";
import type { ResourceName } from "@/features/types/gameplay/resources";

/** Coin value per 1 unit when sold at the Market. */
export const CROP_SELL_PRICES: Record<CropName, number> = {
  Potato:  2,
  Carrot:  5,
  Cabbage: 8,
  Pumpkin: 15,
  Wheat:   20,
};

export const FOOD_SELL_PRICES: Record<Food, number> = {
  "Baked Potato":   8,
  "Cooked Fish":    6,
  "Cabbage Roll":   20,
  "Carrot Stew":    18,
  "Pumpkin Soup":   30,
  "Scrambled Eggs": 25,
  "Wheat Bread":    40,
  "Pumpkin Pie":    50,
};

export const RESOURCE_SELL_PRICES: Partial<Record<ResourceName, number>> = {
  Wood:  3,
  Stone: 4,
};

/** Fish sell prices per fish name. */
export const FISH_SELL_PRICES: Record<string, number> = {
  Fish:        5,
  Salmon:      12,
  Blowfish:    8,
  "Seahorse":  20,
  Squid:       15,
  Crab:        18,
};

/** Produce (animal) sell prices. */
export const PRODUCE_SELL_PRICES: Record<string, number> = {
  Egg:  4,
  Milk: 8,
  Wool: 10,
};

/**
 * Resolves the sell price of any item by name.
 * Returns 0 if the item is not sellable (seeds, tools, animals, etc.).
 */
export function getSellPrice(itemName: string): number {
  if (itemName in CROP_SELL_PRICES)    return CROP_SELL_PRICES[itemName as CropName];
  if (itemName in FOOD_SELL_PRICES)    return FOOD_SELL_PRICES[itemName as Food];
  if (itemName in RESOURCE_SELL_PRICES) return RESOURCE_SELL_PRICES[itemName as ResourceName] ?? 0;
  if (itemName in FISH_SELL_PRICES)    return FISH_SELL_PRICES[itemName];
  if (itemName in PRODUCE_SELL_PRICES) return PRODUCE_SELL_PRICES[itemName];
  return 0;
}

/**
 * shared/game/animals.ts
 *
 * Isomorphic animal definitions.
 *
 * Feed assignments:
 *   Chicken — eats Carrot (1x)
 *   Cow     — eats Wheat (1x)
 *   Sheep   — eats Wheat (1x)
 *
 * Gold prices match ANIMALS in craftables.ts: Chicken 10, Cow 40, Sheep 25.
 */

import type { InventoryItemName } from "@/features/types/gameplay/game";

export type AnimalType = "Chicken" | "Cow" | "Sheep";

export interface AnimalConfig {
  type: AnimalType;
  /** Item consumed when feeding the animal. */
  feedItem: InventoryItemName;
  /** How many of the feed item are consumed per feeding. */
  feedAmount: number;
  /** Item produced after a successful produce cycle. */
  produceItem: InventoryItemName;
  /** Time from feeding → produce ready (ms). */
  produceTimeMs: number;
  /** Cooldown before the animal is hungry again (ms). */
  reHungerDelayMs: number;
  /** Maximum allowed count of this animal on the farm. */
  maxCount: number;
  /** Buy price in coins (placeholder until Phase 5 token marketplace). */
  price: number;
}

export const ANIMALS_CONFIG: Record<AnimalType, AnimalConfig> = {
  Chicken: {
    type: "Chicken",
    feedItem: "Carrot",
    feedAmount: 1,
    produceItem: "Egg",
    produceTimeMs:   4 * 60 * 60 * 1_000,  // 4 hours
    reHungerDelayMs: 4 * 60 * 60 * 1_000,  // 4 hours
    maxCount: 10,
    price: 10,
  },
  Cow: {
    type: "Cow",
    feedItem: "Wheat",
    feedAmount: 1,
    produceItem: "Milk",
    produceTimeMs:   8 * 60 * 60 * 1_000,  // 8 hours
    reHungerDelayMs: 8 * 60 * 60 * 1_000,  // 8 hours
    maxCount: 5,
    price: 40,
  },
  Sheep: {
    type: "Sheep",
    feedItem: "Wheat",
    feedAmount: 1,
    produceItem: "Wool",
    produceTimeMs:   12 * 60 * 60 * 1_000, // 12 hours
    reHungerDelayMs: 12 * 60 * 60 * 1_000, // 12 hours
    maxCount: 5,
    price: 25,
  },
};

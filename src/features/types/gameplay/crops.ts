import Decimal from "decimal.js-light";
import { CROPS_CONFIG } from "@/features/game/crops";
import { Craftable } from "@/features/types/gameplay/craftables";

export type CropName =
  | "Potato"
  | "Carrot"
  | "Cabbage"
  | "Wheat";

/**
 * Client-side crop definition.
 */
export type Crop = {
  harvestSeconds: number;
  name: CropName;
  description: string;
};

/**
 * Client-side crop definitions — 4 crops only.
 *
 * Beetroot, Parsnip, Radish, Cauliflower and Kale are fully abolished.
 * Wheat is now a purchasable crop (seeds cost Wood + Stone) and serves as
 * animal feed for Cow and Sheep.
 *
 * | Crop    | Growth  |
 * |---------|---------|
 * | Potato  | 1 min   |
 * | Carrot  | 5 min   |
 * | Cabbage | 10 min  |
 * | Wheat   | 12 hr   |
 */
export const CROPS: () => Record<CropName, Crop> = () => ({
  Potato:  { harvestSeconds: 60,           name: "Potato",  description: "Starchy and filling." },
  Carrot:  { harvestSeconds: 5 * 60,       name: "Carrot",  description: "Crunchy and sweet."   },
  Cabbage: { harvestSeconds: 10 * 60,      name: "Cabbage", description: "Leafy and fresh."     },
  Wheat:   { harvestSeconds: 12 * 60 * 60, name: "Wheat",   description: "Golden grain."        },
});

export type SeedName = `${CropName} Seed`;

/**
 * Seed shop definitions.
 *
 * Seeds are purchased with Wood and/or Stone (mined resources), not coins.
 * Coins are earned separately by selling crops, food, and resources.
 *
 * | Seed         | Cost              |
 * |--------------|-------------------|
 * | Potato Seed  | 3 Wood            |
 * | Carrot Seed  | 4 Stone           |
 * | Cabbage Seed | 4 Wood + 4 Stone  |
 * | Wheat Seed   | 8 Wood + 10 Stone |
 */
export const SEEDS: () => Record<SeedName, Craftable> = () => ({
  "Potato Seed": {
    name: "Potato Seed",
    price: undefined,
    ingredients: [{ item: "Wood", amount: new Decimal(3) }],
    description: "Grows in 1 min. Costs 3 Wood.",
    farmLevelRequirement: CROPS_CONFIG.Potato.farmingLevelRequired,
  },
  "Carrot Seed": {
    name: "Carrot Seed",
    price: undefined,
    ingredients: [{ item: "Stone", amount: new Decimal(4) }],
    description: "Grows in 5 min. Costs 4 Stone.",
    farmLevelRequirement: CROPS_CONFIG.Carrot.farmingLevelRequired,
  },
  "Cabbage Seed": {
    name: "Cabbage Seed",
    price: undefined,
    ingredients: [
      { item: "Wood",  amount: new Decimal(4) },
      { item: "Stone", amount: new Decimal(4) },
    ],
    description: "Grows in 10 min. Costs 4 Wood + 4 Stone.",
    farmLevelRequirement: CROPS_CONFIG.Cabbage.farmingLevelRequired,
  },
  "Wheat Seed": {
    name: "Wheat Seed",
    price: undefined,
    ingredients: [
      { item: "Wood",  amount: new Decimal(8) },
      { item: "Stone", amount: new Decimal(10) },
    ],
    description: "Grows in 12 hr. Costs 8 Wood + 10 Stone.",
    farmLevelRequirement: CROPS_CONFIG.Wheat.farmingLevelRequired,
  },
});

/**
 * Always returns false — all 4 crops are purchasable, none are quest-gated.
 * Retained for call-site compatibility.
 */
export function isQuestSeedName(_seed: SeedName): boolean {
  return false;
}

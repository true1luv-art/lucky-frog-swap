/**
 * shared/game/crops.ts
 *
 * Isomorphic crop configuration — 5 crops only.
 * Beetroot, Parsnip, Radish, Cauliflower and Kale are fully abolished.
 * Wheat is now a purchasable crop (seeded with Wood + Stone).
 */

export type CropName =
  | "Potato"
  | "Carrot"
  | "Cabbage"
  | "Pumpkin"
  | "Wheat";

export type SeedName = `${CropName} Seed`;

export interface CropConfig {
  name: CropName;
  harvestSeconds: number;
  farmingLevelRequired: number;
  description: string;
}

export const CROPS_CONFIG: Record<CropName, CropConfig> = {
  Potato: {
    name: "Potato",
    harvestSeconds: 60,
    farmingLevelRequired: 0,
    description: "Starchy and filling.",
  },
  Carrot: {
    name: "Carrot",
    harvestSeconds: 5 * 60,
    farmingLevelRequired: 1,
    description: "Crunchy and sweet.",
  },
  Cabbage: {
    name: "Cabbage",
    harvestSeconds: 10 * 60,
    farmingLevelRequired: 2,
    description: "Leafy and fresh.",
  },
  Pumpkin: {
    name: "Pumpkin",
    harvestSeconds: 30 * 60,
    farmingLevelRequired: 3,
    description: "Big and orange.",
  },
  Wheat: {
    name: "Wheat",
    harvestSeconds: 12 * 60 * 60,
    farmingLevelRequired: 5,
    description: "Golden grain. Also feeds Cow and Sheep.",
  },
};

/** All 5 crops are purchasable — none are quest-gated. */
export function isQuestSeed(_crop: CropName): boolean {
  return false;
}

export function getShopSeeds(): SeedName[] {
  return (Object.keys(CROPS_CONFIG) as CropName[]).map(
    (c) => `${c} Seed` as SeedName,
  );
}

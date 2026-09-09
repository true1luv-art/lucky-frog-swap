import Decimal from "decimal.js-light";
import { CROPS_CONFIG } from "@/shared/data/farming";
import { Craftable } from "@/shared/types/gameplay/craftables";

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

export type Crop = {
  buyPrice: Decimal;
  sellPrice: Decimal;
  harvestSeconds: number;
  name: CropName;
  description: string;
};

/**
 * Client-side crop definitions, halving-aware.
 *
 * `halvingMultiplier` scales all buy/sell prices to the current emission stage.
 * It defaults to `1` (Genesis) so existing call sites remain backward-compatible;
 * halving-aware callers pass `state.halvingMultiplier`.
 * See docs/halving-price-integration.md §5 Step 4c.
 */
export const CROPS: (halvingMultiplier?: number) => Record<CropName, Crop> = (
  halvingMultiplier = 1,
) => ({
  Potato: {
    buyPrice: new Decimal(2.5 * halvingMultiplier),
    sellPrice: new Decimal(4 * halvingMultiplier),
    harvestSeconds: 60,
    name: "Potato",
    description: "Starchy and filling.",
  },
  Carrot: {
    buyPrice: new Decimal(6 * halvingMultiplier),
    sellPrice: new Decimal(10 * halvingMultiplier),
    harvestSeconds: 5 * 60,
    name: "Carrot",
    description: "Crunchy and sweet.",
  },
  Cabbage: {
    buyPrice: new Decimal(12 * halvingMultiplier),
    sellPrice: new Decimal(18 * halvingMultiplier),
    harvestSeconds: 10 * 60,
    name: "Cabbage",
    description: "Leafy and fresh.",
  },
  Pumpkin: {
    buyPrice: new Decimal(25 * halvingMultiplier),
    sellPrice: new Decimal(40 * halvingMultiplier),
    harvestSeconds: 30 * 60,
    name: "Pumpkin",
    description: "Big and orange.",
  },
  Beetroot: {
    buyPrice: new Decimal(45 * halvingMultiplier),
    sellPrice: new Decimal(80 * halvingMultiplier),
    harvestSeconds: 60 * 60,
    name: "Beetroot",
    description: "Sweet and earthy.",
  },
  Parsnip: {
    buyPrice: new Decimal(80 * halvingMultiplier),
    sellPrice: new Decimal(150 * halvingMultiplier),
    harvestSeconds: 2 * 60 * 60,
    name: "Parsnip",
    description: "Pale and sweet.",
  },
  Radish: {
    buyPrice: new Decimal(120 * halvingMultiplier),
    sellPrice: new Decimal(250 * halvingMultiplier),
    harvestSeconds: 3 * 60 * 60,
    name: "Radish",
    description: "Peppery crunch.",
  },
  Cauliflower: {
    buyPrice: new Decimal(180 * halvingMultiplier),
    sellPrice: new Decimal(440 * halvingMultiplier),
    harvestSeconds: 6 * 60 * 60,
    name: "Cauliflower",
    description: "White and fluffy.",
  },
  Wheat: {
    buyPrice: new Decimal(260 * halvingMultiplier),
    sellPrice: new Decimal(700 * halvingMultiplier),
    harvestSeconds: 12 * 60 * 60,
    name: "Wheat",
    description: "Golden grain.",
  },
  Kale: {
    buyPrice: new Decimal(400 * halvingMultiplier),
    sellPrice: new Decimal(1125 * halvingMultiplier),
    harvestSeconds: 24 * 60 * 60,
    name: "Kale",
    description: "Super greens.",
  },
});

export type SeedName = `${CropName} Seed`;

/**
 * Client-side seed definitions, halving-aware. `halvingMultiplier` scales all
 * seed prices to the current emission stage and defaults to `1` (Genesis) for
 * backward compatibility. See docs/halving-price-integration.md §5 Step 4c.
 */
export const SEEDS: (halvingMultiplier?: number) => Record<SeedName, Craftable> = (
  halvingMultiplier = 1,
) => ({
  "Potato Seed": {
    name: "Potato Seed",
    price: new Decimal(2.5 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 1 min.",
    levelRequirement: CROPS_CONFIG.Potato.farmingLevelRequired,
  },
  "Carrot Seed": {
    name: "Carrot Seed",
    price: new Decimal(6 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 5 min.",
    levelRequirement: CROPS_CONFIG.Carrot.farmingLevelRequired,
  },
  "Cabbage Seed": {
    name: "Cabbage Seed",
    price: new Decimal(12 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 10 min.",
    levelRequirement: CROPS_CONFIG.Cabbage.farmingLevelRequired,
  },
  "Pumpkin Seed": {
    name: "Pumpkin Seed",
    price: new Decimal(25 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 30 min.",
    levelRequirement: CROPS_CONFIG.Pumpkin.farmingLevelRequired,
  },
  "Beetroot Seed": {
    name: "Beetroot Seed",
    price: new Decimal(45 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 1 hour.",
    levelRequirement: CROPS_CONFIG.Beetroot.farmingLevelRequired,
  },
  "Parsnip Seed": {
    name: "Parsnip Seed",
    price: new Decimal(80 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 2 hours.",
    levelRequirement: CROPS_CONFIG.Parsnip.farmingLevelRequired,
  },
  "Radish Seed": {
    name: "Radish Seed",
    price: new Decimal(120 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 3 hours.",
    levelRequirement: CROPS_CONFIG.Radish.farmingLevelRequired,
  },
  "Cauliflower Seed": {
    name: "Cauliflower Seed",
    price: new Decimal(180 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 6 hours.",
    levelRequirement: CROPS_CONFIG.Cauliflower.farmingLevelRequired,
  },
  "Wheat Seed": {
    name: "Wheat Seed",
    price: new Decimal(260 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 12 hours.",
    levelRequirement: CROPS_CONFIG.Wheat.farmingLevelRequired,
  },
  "Kale Seed": {
    name: "Kale Seed",
    price: new Decimal(400 * halvingMultiplier),
    ingredients: [],
    description: "Grows in 24 hours.",
    levelRequirement: CROPS_CONFIG.Kale.farmingLevelRequired,
  },
});

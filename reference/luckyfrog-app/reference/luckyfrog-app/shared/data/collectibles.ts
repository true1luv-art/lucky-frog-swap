import Decimal from "decimal.js-light";
import type {
  CollectibleDefinition,
  CollectibleName,
} from "@/shared/types/gameplay/collectibles";

export const COLLECTIBLE_MAX_SUPPLY = 1_500 as const;
export const COLLECTIBLE_BONUS_AMOUNT = 0.1 as const;

export const COLLECTIBLES: Record<CollectibleName, CollectibleDefinition> = {
  "Harvest Scarecrow": {
    name: "Harvest Scarecrow",
    system: "harvesting",
    description: "A tireless field guardian that helps crops grow 10% faster.",
    image: "/assets/collectibles/harvest-scarecrow.png",
    maxSupply: COLLECTIBLE_MAX_SUPPLY,
    effect: { bonusKey: "cropSpeed", amount: COLLECTIBLE_BONUS_AMOUNT, description: "Crops grow 10% faster" },
    ingredients: [
      ["Potato", 2500], ["Carrot", 1500], ["Cabbage", 1000],
      ["Pumpkin", 750], ["Beetroot", 500], ["Parsnip", 300],
      ["Radish", 200], ["Cauliflower", 100], ["Wheat", 100],
      ["Kale", 50], ["Wood", 1000],
    ].map(([item, amount]) => ({ item: item as CollectibleDefinition["ingredients"][number]["item"], amount: new Decimal(amount) })),
  },
  "Forester's Totem": {
    name: "Forester's Totem",
    system: "trees",
    description: "An old woodland charm that makes trees recover 10% faster.",
    image: "/assets/collectibles/foresters-totem.png",
    maxSupply: COLLECTIBLE_MAX_SUPPLY,
    effect: { bonusKey: "woodRecovery", amount: COLLECTIBLE_BONUS_AMOUNT, description: "Trees recover 10% faster" },
    ingredients: [["Wood", 7700], ["Stone", 1000], ["Iron", 250], ["Gold", 50]].map(([item, amount]) => ({ item: item as CollectibleDefinition["ingredients"][number]["item"], amount: new Decimal(amount) })),
  },
  "Fisher's Shrine": {
    name: "Fisher's Shrine",
    system: "fishing",
    description: "A sea-worn shrine that shortens fishing cooldowns by 10%.",
    image: "/assets/collectibles/fishers-shrine.png",
    maxSupply: COLLECTIBLE_MAX_SUPPLY,
    effect: { bonusKey: "fishSpeed", amount: COLLECTIBLE_BONUS_AMOUNT, description: "Fishing cooldown is 10% shorter" },
    ingredients: [
      ["Wood", 2000], ["Stone", 1000], ["Anchovy", 750],
      ["Sardine", 500], ["Tilapia", 300], ["Herring", 200],
      ["Trout", 100], ["Sea Bass", 50], ["Mackerel", 25], ["Salmon", 10],
    ].map(([item, amount]) => ({ item: item as CollectibleDefinition["ingredients"][number]["item"], amount: new Decimal(amount) })),
  },
  "Miner's Monument": {
    name: "Miner's Monument",
    system: "mining",
    description: "A carved tribute that makes Stone, Iron, and Gold recover 10% faster.",
    image: "/assets/collectibles/miners-monument.png",
    maxSupply: COLLECTIBLE_MAX_SUPPLY,
    effect: { bonusKey: "oreRecovery", amount: COLLECTIBLE_BONUS_AMOUNT, description: "Mining nodes recover 10% faster" },
    ingredients: [["Stone", 5500], ["Iron", 1200], ["Gold", 250], ["Wood", 1000]].map(([item, amount]) => ({ item: item as CollectibleDefinition["ingredients"][number]["item"], amount: new Decimal(amount) })),
  },
  "Chef's Cauldron": {
    name: "Chef's Cauldron",
    system: "cooking",
    description: "A seasoned cauldron that completes every recipe 10% faster.",
    image: "/assets/collectibles/chefs-cauldron.png",
    maxSupply: COLLECTIBLE_MAX_SUPPLY,
    effect: { bonusKey: "cookingSpeed", amount: COLLECTIBLE_BONUS_AMOUNT, description: "Cooking takes 10% less time" },
    ingredients: [
      ["Stone", 1500], ["Iron", 500], ["Gold", 100],
      ["Roasted Potato", 250], ["Carrot Stew", 150], ["Cabbage Roll", 100],
      ["Pumpkin Soup", 75], ["Beetroot Salad", 50], ["Parsnip Porridge", 25],
      ["Radish Skewers", 10],
    ].map(([item, amount]) => ({ item: item as CollectibleDefinition["ingredients"][number]["item"], amount: new Decimal(amount) })),
  },
  "Husbandry Bell": {
    name: "Husbandry Bell",
    system: "husbandry",
    description: "A clear-toned bell that helps all farm animals produce 10% faster.",
    image: "/assets/collectibles/husbandry-bell.png",
    maxSupply: COLLECTIBLE_MAX_SUPPLY,
    effect: { bonusKey: "produceSpeed", amount: COLLECTIBLE_BONUS_AMOUNT, description: "Animals produce 10% faster" },
    ingredients: [
      ["Wood", 2000], ["Stone", 1000], ["Iron", 500], ["Gold", 100],
      ["Wheat", 1000], ["Kale", 750], ["Cabbage", 1000],
      ["Egg", 1000], ["Milk", 500], ["Wool", 500],
    ].map(([item, amount]) => ({ item: item as CollectibleDefinition["ingredients"][number]["item"], amount: new Decimal(amount) })),
  },
};

export function isCollectibleName(value: string): value is CollectibleName {
  return value in COLLECTIBLES;
}

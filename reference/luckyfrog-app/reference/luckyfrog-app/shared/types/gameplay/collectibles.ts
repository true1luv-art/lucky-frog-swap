import type Decimal from "decimal.js-light";
import type { InventoryItemName } from "@/shared/types/gameplay/game";
import type { SkillBonus } from "@/shared/types/gameplay/skills";

export const COLLECTIBLE_NAMES = [
  "Harvest Scarecrow",
  "Forester's Totem",
  "Fisher's Shrine",
  "Miner's Monument",
  "Chef's Cauldron",
  "Husbandry Bell",
] as const;

export type CollectibleName = (typeof COLLECTIBLE_NAMES)[number];

export type CollectibleSystem =
  | "harvesting"
  | "trees"
  | "fishing"
  | "mining"
  | "cooking"
  | "husbandry";

export type CollectibleBonusKey = Extract<
  keyof SkillBonus,
  | "cropSpeed"
  | "woodRecovery"
  | "fishSpeed"
  | "oreRecovery"
  | "cookingSpeed"
  | "produceSpeed"
>;

export interface CollectibleIngredient {
  item: InventoryItemName;
  amount: Decimal;
}

export interface CollectibleEffect {
  bonusKey: CollectibleBonusKey;
  amount: number;
  description: string;
}

export interface CollectibleDefinition {
  name: CollectibleName;
  system: CollectibleSystem;
  description: string;
  image: string;
  maxSupply: 1500;
  effect: CollectibleEffect;
  ingredients: CollectibleIngredient[];
}

import { InventoryItemName } from "@/features/types/gameplay/game";
import { FOODS } from "@/features/types/gameplay/craftables";
import { CROPS, SEEDS } from "@/features/types/gameplay/crops";
import { RESOURCES } from "@/features/types/gameplay/resources";
import type { FishName } from "@/features/types/gameplay/fish";

export type ItemDetails = {
  description: string;
  image: string;
  secondaryImage?: string;
  section?: string;
};

type ItemDetailsMap = Record<InventoryItemName, ItemDetails>;

const FISH_NAMES: FishName[] = ["Fish"];

const FISH_DESCRIPTIONS: Record<FishName, string> = {
  Fish: "A freshly caught fish.",
};

const fishEntries = Object.fromEntries(
  FISH_NAMES.map((name) => [
    name,
    { description: FISH_DESCRIPTIONS[name], image: "/assets/fish/fish.png" } as ItemDetails,
  ])
) as Record<FishName, ItemDetails>;

const crops = CROPS();
const seeds = SEEDS();

// Tools are no longer stackable items — they live in state.tools[] as ToolInstance objects.
// They are excluded from ITEM_DETAILS which only covers InventoryItemName entries.
export const ITEM_DETAILS: ItemDetailsMap = {
  Potato:  { ...crops.Potato,  image: "/assets/crops/potato/crop.png" },
  Pumpkin: { ...crops.Pumpkin, image: "/assets/crops/pumpkin/crop.png" },
  Carrot:  { ...crops.Carrot,  image: "/assets/crops/carrot/crop.png" },
  Cabbage: { ...crops.Cabbage, image: "/assets/crops/cabbage/crop.png" },
  Wheat:   { ...crops.Wheat,   image: "/assets/crops/wheat/crop.png" },

  "Potato Seed":  { ...seeds["Potato Seed"],  image: "/assets/crops/potato/seed.png",  secondaryImage: "/assets/crops/potato/crop.png" },
  "Carrot Seed":  { ...seeds["Carrot Seed"],  image: "/assets/crops/carrot/seed.png",  secondaryImage: "/assets/crops/carrot/crop.png" },
  "Cabbage Seed": { ...seeds["Cabbage Seed"], image: "/assets/crops/cabbage/seed.png", secondaryImage: "/assets/crops/cabbage/crop.png" },
  "Pumpkin Seed": { ...seeds["Pumpkin Seed"], image: "/assets/crops/pumpkin/seed.png", secondaryImage: "/assets/crops/pumpkin/crop.png" },
  "Wheat Seed":   { ...seeds["Wheat Seed"],   image: "/assets/crops/wheat/seed.png",   secondaryImage: "/assets/crops/wheat/crop.png" },

  Wood:     { ...RESOURCES["Wood"],     image: "/assets/resources/wood.png" },
  Stone:    { ...RESOURCES["Stone"],    image: "/assets/resources/stone.png" },
  Iron:     { ...RESOURCES["Iron"],     image: "/assets/resources/iron_ore.png" },
  Silver:   { ...RESOURCES["Silver"],   image: "/assets/resources/iron_ore.png" },
  Emerald:  { ...RESOURCES["Emerald"],  image: "/assets/resources/emerald_ore.png" },
  Diamond:  { ...RESOURCES["Diamond"],  image: "/assets/resources/diamond_ore.png" },
  Ignisite: { ...RESOURCES["Ignisite"], image: "/assets/resources/ignisite_ore.png" },
  Coal:     { ...RESOURCES["Coal"],     image: "/assets/resources/stone.png" },
  "Iron Ingot":     { ...RESOURCES["Iron Ingot"],     image: "/assets/resources/iron_ore.png" },
  "Silver Ingot":   { ...RESOURCES["Silver Ingot"],   image: "/assets/resources/iron_ore.png" },
  "Emerald Ingot":  { ...RESOURCES["Emerald Ingot"],  image: "/assets/resources/emerald_ore.png" },
  "Diamond Ingot":  { ...RESOURCES["Diamond Ingot"],  image: "/assets/resources/diamond_ore.png" },
  "Ignisite Ingot": { ...RESOURCES["Ignisite Ingot"], image: "/assets/resources/ignisite_ore.png" },
  Gold:     { ...RESOURCES["Gold"],     image: "/assets/resources/gold_ore.png" },
  Egg:      { ...RESOURCES["Egg"],      image: "/assets/resources/egg.png" },
  Milk:     { ...RESOURCES["Milk"],     image: "/assets/resources/milk.png" },
  Wool:     { ...RESOURCES["Wool"],     image: "/assets/resources/wool.png" },
  Chicken:  { ...RESOURCES["Chicken"],  image: "/assets/animals/chicken.png" },
  Cow:      { ...RESOURCES["Cow"],      image: "/assets/animals/cow.png" },
  Sheep:    { ...RESOURCES["Sheep"],    image: "/assets/animals/sheep.png" },

  "Baked Potato":    { ...FOODS()["Baked Potato"],    image: "/assets/foods/roasted_potato.png" },
  "Cooked Fish":     { ...FOODS()["Cooked Fish"],     image: "/assets/foods/cooked_fish.png" },
  "Cabbage Roll":    { ...FOODS()["Cabbage Roll"],    image: "/assets/foods/cabbage_roll.png" },
  "Carrot Stew":     { ...FOODS()["Carrot Stew"],     image: "/assets/foods/carrot_stew.png" },
  "Pumpkin Soup":    { ...FOODS()["Pumpkin Soup"],    image: "/assets/foods/pumpkin_soup.png" },
  "Scrambled Eggs":  { ...FOODS()["Scrambled Eggs"],  image: "/assets/foods/scrambled_eggs.png" },
  "Wheat Bread":     { ...FOODS()["Wheat Bread"],     image: "/assets/foods/wheat_bread.png" },
  "Pumpkin Pie":     { ...FOODS()["Pumpkin Pie"],     image: "/assets/foods/pumpkin_pie.png" },

  ...fishEntries,

  // Currency / crafting material
  Shard: {
    ...RESOURCES["Shard"],
    image: "/assets/resources/shard.png",
  },
};

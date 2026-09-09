import { InventoryItemName } from "@/shared/types/gameplay/game";
import { FOODS } from "@/shared/types/gameplay/craftables";
import { CROPS, SEEDS } from "@/shared/types/gameplay/crops";
import { RESOURCES } from "@/shared/types/gameplay/resources";
import { FishName } from "@/shared/types/gameplay/fish";

export type ItemDetails = {
  description: string;
  image: string;
  secondaryImage?: string;
  section?: string;
};

type Items = Record<InventoryItemName, ItemDetails>;

const FISH_NAMES: FishName[] = [
  "Anchovy", "Sardine", "Tilapia", "Herring", "Trout", "Sea Bass",
  "Mackerel", "Salmon", "Red Snapper", "Barracuda", "Tuna",
  "Swordfish", "Blue Marlin", "Oarfish",
];

const FISH_DESCRIPTIONS: Record<FishName, string> = {
  Anchovy:        "A small, oily fish found near the shore.",
  Sardine:        "Packed with flavour — a fisherman's staple.",
  Tilapia:        "A mild freshwater fish, easy to cook.",
  Herring:        "Schooling fish famous for its rich taste.",
  Trout:          "Prized for its delicate, pink flesh.",
  "Sea Bass":     "A refined fish with firm white meat.",
  Mackerel:       "Bold-flavoured and packed with omega-3.",
  Salmon:         "The king of river fish, prized by all.",
  "Red Snapper":  "Deep-red scales and succulent flesh.",
  Barracuda:      "A fierce predator of the shallows.",
  Tuna:           "A powerful open-water fish.",
  Swordfish:      "Legendary for its speed and size.",
  "Blue Marlin":  "The ultimate trophy catch.",
  Oarfish:        "A rare, serpentine deep-sea giant.",
};

const fishEntries = Object.fromEntries(
  FISH_NAMES.map((name) => [
    name,
    { description: FISH_DESCRIPTIONS[name], image: "/assets/fish/fish.png" } as ItemDetails,
  ])
) as Record<FishName, ItemDetails>;

const crops = CROPS();
const seeds = SEEDS();

export const ITEM_DETAILS: Items = {
  Potato:      { ...crops.Potato,      image: "/assets/crops/potato/crop.png" },
  Pumpkin:     { ...crops.Pumpkin,     image: "/assets/crops/pumpkin/crop.png" },
  Carrot:      { ...crops.Carrot,      image: "/assets/crops/carrot/crop.png" },
  Cabbage:     { ...crops.Cabbage,     image: "/assets/crops/cabbage/crop.png" },
  Beetroot:    { ...crops.Beetroot,    image: "/assets/crops/beetroot/crop.png" },
  Cauliflower: { ...crops.Cauliflower, image: "/assets/crops/cauliflower/crop.png" },
  Parsnip:     { ...crops.Parsnip,     image: "/assets/crops/parsnip/crop.png" },
  Radish:      { ...crops.Radish,      image: "/assets/crops/radish/crop.png" },
  Wheat:       { ...crops.Wheat,       image: "/assets/crops/wheat/crop.png" },
  Kale:        { ...crops.Kale,        image: "/assets/crops/kale/crop.png" },

  "Potato Seed":      { ...seeds["Potato Seed"],      image: "/assets/crops/potato/seed.png",      secondaryImage: "/assets/crops/potato/crop.png" },
  "Pumpkin Seed":     { ...seeds["Pumpkin Seed"],     image: "/assets/crops/pumpkin/seed.png",     secondaryImage: "/assets/crops/pumpkin/crop.png" },
  "Carrot Seed":      { ...seeds["Carrot Seed"],      image: "/assets/crops/carrot/seed.png",      secondaryImage: "/assets/crops/carrot/crop.png" },
  "Cabbage Seed":     { ...seeds["Cabbage Seed"],     image: "/assets/crops/cabbage/seed.png",     secondaryImage: "/assets/crops/cabbage/crop.png" },
  "Beetroot Seed":    { ...seeds["Beetroot Seed"],    image: "/assets/crops/beetroot/seed.png",    secondaryImage: "/assets/crops/beetroot/crop.png" },
  "Cauliflower Seed": { ...seeds["Cauliflower Seed"], image: "/assets/crops/cauliflower/seed.png", secondaryImage: "/assets/crops/cauliflower/crop.png" },
  "Parsnip Seed":     { ...seeds["Parsnip Seed"],     image: "/assets/crops/parsnip/seed.png",     secondaryImage: "/assets/crops/parsnip/crop.png" },
  "Radish Seed":      { ...seeds["Radish Seed"],      image: "/assets/crops/radish/seed.png",      secondaryImage: "/assets/crops/radish/crop.png" },
  "Wheat Seed":       { ...seeds["Wheat Seed"],       image: "/assets/crops/wheat/seed.png",       secondaryImage: "/assets/crops/wheat/crop.png" },
  "Kale Seed":        { ...seeds["Kale Seed"],        image: "/assets/crops/kale/seed.png",        secondaryImage: "/assets/crops/kale/crop.png" },

  Wood:    { ...RESOURCES["Wood"],    image: "/assets/resources/wood.png" },
  Stone:   { ...RESOURCES["Stone"],   image: "/assets/resources/stone.png" },
  Iron:    { ...RESOURCES["Iron"],    image: "/assets/resources/iron_ore.png" },
  Gold:    { ...RESOURCES["Gold"],    image: "/assets/resources/gold_ore.png" },
  Egg:     { ...RESOURCES["Egg"],     image: "/assets/resources/egg.png" },
  Milk:    { ...RESOURCES["Milk"],    image: "/assets/resources/milk.png" },
  Wool:    { ...RESOURCES["Wool"],    image: "/assets/resources/wool.png" },
  Chicken: { ...RESOURCES["Chicken"], image: "/assets/animals/chicken.png" },
  Cow:     { description: "Produces milk. Eats Kale.",     image: "/assets/animals/cow.png" },
  Sheep:   { description: "Produces wool. Eats Cabbage.",  image: "/assets/animals/sheep.png" },

  "Roasted Potato":       { ...FOODS()["Roasted Potato"],       image: "/assets/foods/roasted_potato.png" },
  "Carrot Stew":          { ...FOODS()["Carrot Stew"],          image: "/assets/foods/carrot_stew.png" },
  "Cabbage Roll":         { ...FOODS()["Cabbage Roll"],         image: "/assets/foods/cabbage_roll.png" },
  "Pumpkin Soup":         { ...FOODS()["Pumpkin Soup"],         image: "/assets/foods/pumpkin_soup.png" },
  "Beetroot Salad":       { ...FOODS()["Beetroot Salad"],       image: "/assets/foods/beetroot_salad.png" },
  "Parsnip Porridge":     { ...FOODS()["Parsnip Porridge"],     image: "/assets/foods/parsnip_porridge.png" },
  "Radish Skewers":       { ...FOODS()["Radish Skewers"],       image: "/assets/foods/radish_skewers.png" },
  "Cauliflower Sandwich": { ...FOODS()["Cauliflower Sandwich"], image: "/assets/foods/cauliflower_sandwich.png" },
  "Wheat Bread":          { ...FOODS()["Wheat Bread"],          image: "/assets/foods/wheat_bread.png" },
  "Kale Stir-fry":        { ...FOODS()["Kale Stir-fry"],        image: "/assets/foods/kale_stirfry.png" },

  ...fishEntries,
};

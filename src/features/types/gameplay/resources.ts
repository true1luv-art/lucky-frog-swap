export type OreType = "Iron" | "Silver" | "Emerald" | "Diamond" | "Ignisite";

export type ResourceName =
  | "Wood"
  | "Stone"
  | "Iron"
  | "Silver"
  | "Emerald"
  | "Diamond"
  | "Ignisite"
  | "Coal"
  | "Iron Ingot"
  | "Silver Ingot"
  | "Emerald Ingot"
  | "Diamond Ingot"
  | "Ignisite Ingot"
  | "Gold"
  | "Egg"
  | "Milk"
  | "Wool"
  | "Chicken"
  | "Cow"
  | "Sheep"
  | "Shard";

export type Resource = {
  description: string;
};

export const RESOURCES: Record<ResourceName, Resource> = {
  Wood:             { description: "Used to craft tools, cook food, and make Coal." },
  Stone:            { description: "Used to purchase seeds and craft tools." },
  Iron:             { description: "A sturdy ore. Smelt 10 + 1 Coal into an Iron Ingot." },
  Silver:           { description: "A gleaming ore. Smelt 10 + 1 Coal into a Silver Ingot." },
  Emerald:          { description: "A rare green ore. Smelt 10 + 1 Coal into an Emerald Ingot." },
  Diamond:          { description: "A brilliant ore. Smelt 10 + 1 Coal into a Diamond Ingot." },
  Ignisite:         { description: "A legendary molten ore. Smelt 10 + 1 Coal into an Ignisite Ingot." },
  Coal:             { description: "Fuel for the forge. Craft from 2 Wood at the Blacksmith." },
  "Iron Ingot":     { description: "Refined iron. Used to forge equipment at the Blacksmith." },
  "Silver Ingot":   { description: "Refined silver. Used to forge mid-tier equipment." },
  "Emerald Ingot":  { description: "Refined emerald. Used to forge high-tier equipment." },
  "Diamond Ingot":  { description: "Refined diamond. Used to forge superior equipment." },
  "Ignisite Ingot": { description: "Refined ignisite. Used to forge the finest equipment." },
  Gold:             { description: "The realm's currency. Earned from quests and spent on upgrades." },
  Egg:              { description: "Produced by chickens. Trade in the Marketplace." },
  Milk:             { description: "Produced by cows. Trade in the Marketplace." },
  Wool:             { description: "Produced by sheep. Trade in the Marketplace." },
  Chicken:          { description: "Lays eggs when fed Carrot." },
  Cow:              { description: "Produces milk when fed Wheat." },
  Sheep:            { description: "Produces wool when fed Wheat." },
  Shard:            { description: "Earned by destroying Iron or higher armors. Used to upgrade armors at the Blacksmith." },
};

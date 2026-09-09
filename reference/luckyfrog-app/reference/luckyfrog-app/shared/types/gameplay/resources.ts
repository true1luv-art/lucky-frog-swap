export type ResourceName =
  | "Wood"
  | "Stone"
  | "Iron"
  | "Gold"
  | "Egg"
  | "Milk"
  | "Wool"
  | "Chicken"
  | "Anchovy"
  | "Sardine"
  | "Tilapia"
  | "Herring"
  | "Trout"
  | "Sea Bass"
  | "Mackerel"
  | "Salmon"
  | "Red Snapper"
  | "Barracuda"
  | "Tuna"
  | "Swordfish"
  | "Blue Marlin"
  | "Oarfish";

export type Resource = {
  description: string;
  sellPrice?: number;
};

export const RESOURCES: Record<ResourceName, Resource> = {
  Wood:  { description: "Used to craft items" },
  Stone: { description: "Used to craft items" },
  Iron:  { description: "Used to craft items" },
  Gold:  { description: "Used to craft items" },
  Egg:   { description: "Produced by chickens. Sell at the Market.", sellPrice: 0.08 },
  Milk:  { description: "Produced by cows. Sell at the Market.", sellPrice: 1.5 },
  Wool:  { description: "Produced by sheep. Sell at the Market.", sellPrice: 0.9 },
  Chicken: { description: "Used to lay eggs" },
  Anchovy:      { description: "A small, common saltwater fish.", sellPrice: 0.30 },
  Sardine:      { description: "A small schooling fish.", sellPrice: 0.35 },
  Tilapia:      { description: "A freshwater fish.", sellPrice: 0.40 },
  Herring:      { description: "A silvery fish found near the shore.", sellPrice: 0.45 },
  Trout:        { description: "A speckled fish from clear streams.", sellPrice: 0.60 },
  "Sea Bass":   { description: "A firm-fleshed fish.", sellPrice: 0.80 },
  Mackerel:     { description: "A fast-swimming fish with bold stripes.", sellPrice: 1.00 },
  Salmon:       { description: "A prized pink-fleshed fish.", sellPrice: 1.20 },
  "Red Snapper":{ description: "A striking red fish.", sellPrice: 1.80 },
  Barracuda:    { description: "A fierce predator of the shallows.", sellPrice: 2.50 },
  Tuna:         { description: "A large, powerful ocean fish.", sellPrice: 3.50 },
  Swordfish:    { description: "A majestic billfish of the open sea.", sellPrice: 5.00 },
  "Blue Marlin":{ description: "A legendary deep-sea trophy fish.", sellPrice: 8.00 },
  Oarfish:      { description: "An enormously rare serpentine fish.", sellPrice: 15.00 },
};

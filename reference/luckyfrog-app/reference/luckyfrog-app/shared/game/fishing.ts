import { FishName } from "@/shared/types/gameplay/fish";

export type FishEntry = {
  name: FishName;
  weight: number;
  minLevel: number;
  sellPrice: number;
};

export const FISH_TABLE: FishEntry[] = [
  { name: "Anchovy",      weight: 50,  minLevel: 0,  sellPrice: 0.30  },
  { name: "Sardine",      weight: 45,  minLevel: 0,  sellPrice: 0.35  },
  { name: "Tilapia",      weight: 40,  minLevel: 0,  sellPrice: 0.40  },
  { name: "Herring",      weight: 35,  minLevel: 0,  sellPrice: 0.45  },
  { name: "Trout",        weight: 28,  minLevel: 10, sellPrice: 0.60  },
  { name: "Sea Bass",     weight: 22,  minLevel: 10, sellPrice: 0.80  },
  { name: "Mackerel",     weight: 18,  minLevel: 20, sellPrice: 1.00  },
  { name: "Salmon",       weight: 15,  minLevel: 20, sellPrice: 1.20  },
  { name: "Red Snapper",  weight: 10,  minLevel: 30, sellPrice: 1.80  },
  { name: "Barracuda",    weight: 7,   minLevel: 40, sellPrice: 2.50  },
  { name: "Tuna",         weight: 5,   minLevel: 50, sellPrice: 3.50  },
  { name: "Swordfish",    weight: 3,   minLevel: 60, sellPrice: 5.00  },
  { name: "Blue Marlin",  weight: 1.5, minLevel: 70, sellPrice: 8.00  },
  { name: "Oarfish",      weight: 0.5, minLevel: 90, sellPrice: 15.00 },
];

export function rollCatch(fishingLevel: number): FishName {
  const eligible = FISH_TABLE.filter((f) => fishingLevel >= f.minLevel);
  const totalWeight = eligible.reduce((sum, f) => sum + f.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of eligible) {
    roll -= entry.weight;
    if (roll <= 0) return entry.name;
  }
  return eligible[eligible.length - 1].name;
}

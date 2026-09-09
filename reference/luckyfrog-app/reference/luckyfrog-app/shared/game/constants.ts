import Decimal from "decimal.js-light";
import { ChickenPosition, GameState } from "@/shared/types/gameplay/game";
import { INITIAL_SKILLS, INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { INITIAL_EQUIPMENT, INITIAL_BASE_STATS, computeStats } from "@/shared/types/gameplay/equipment";

export const GRID_WIDTH_PX = 42;

export const CHICKEN_TIME_TO_EGG    = 60 * 1000;       // 1 minute
export const COW_TIME_TO_MILK       = 90 * 1000;       // 1.5 minutes
export const SHEEP_TIME_TO_WOOL     = 120 * 1000;      // 2 minutes

export const CHICKEN_RE_HUNGER_DELAY = 4 * 60 * 60 * 1000;
export const COW_RE_HUNGER_DELAY     = 6 * 60 * 60 * 1000;
export const SHEEP_RE_HUNGER_DELAY   = 6 * 60 * 60 * 1000;

export const FISHING_BASE_COOLDOWN_MS = 30_000;
export const FISHING_MIN_COOLDOWN_MS  = 15_000;

export const MAX_CHICKENS = 10;
export const MAX_COWS     = 5;
export const MAX_SHEEP    = 5;

export const CHICKEN_POSITIONS: ChickenPosition[] = [
  { top: 0, right: 0 }, { top: 0, right: 50 }, { top: 0, right: 100 },
  { top: 0, right: 150 }, { top: 0, right: 200 },
  { top: 50, right: 0 }, { top: 50, right: 50 }, { top: 50, right: 100 },
  { top: 50, right: 150 }, { top: 50, right: 200 },
];

export const COW_POSITIONS: ChickenPosition[] = [
  { top: 0, right: 0 }, { top: 0, right: 60 }, { top: 0, right: 120 },
  { top: 50, right: 0 }, { top: 50, right: 60 },
];

export const SHEEP_POSITIONS: ChickenPosition[] = [
  { top: 0, right: 0 }, { top: 0, right: 60 }, { top: 0, right: 120 },
  { top: 50, right: 0 }, { top: 50, right: 60 },
];

export const INITIAL_FIELDS: GameState["fields"] = {
  0: { name: "Potato", plantedAt: 0, amount: 1 },
  1: { name: "Potato", plantedAt: 0, amount: 1 },
  2: { name: "Potato", plantedAt: 0, amount: 1 },
};

export const INITIAL_TREES: GameState["trees"] = {
  0: { name: "Wood", choppedAt: 0, amount: 3 },
  1: { name: "Wood", choppedAt: 0, amount: 4 },
  2: { name: "Wood", choppedAt: 0, amount: 5 },
  3: { name: "Wood", choppedAt: 0, amount: 5 },
  4: { name: "Wood", choppedAt: 0, amount: 3 },
};

export const INITIAL_STONE: GameState["stones"] = {
  0: { name: "Stone", minedAt: 0, amount: 2 },
  1: { name: "Stone", minedAt: 0, amount: 3 },
  2: { name: "Stone", minedAt: 0, amount: 4 },
};

export const INITIAL_IRON: GameState["iron"] = {
  0: { name: "Iron", minedAt: 0, amount: 2 },
  1: { name: "Iron", minedAt: 0, amount: 3 },
};

export const INITIAL_GOLD: GameState["gold"] = {
  0: { name: "Gold", minedAt: 0, amount: 2 },
};

export const INITIAL_FARM: GameState = {
  balance:  new Decimal(1000),
  fields:   INITIAL_FIELDS,
  inventory: {
    "Potato Seed": new Decimal(10),
    Potato:   new Decimal(5),
    Carrot:   new Decimal(12),
    Wheat:    new Decimal(25),
    Kale:     new Decimal(10),
    Cabbage:  new Decimal(10),
    Chicken:  new Decimal(2),
    Cow:      new Decimal(1),
    Sheep:    new Decimal(1),
  },
  trees:    INITIAL_TREES,
  stones:   INITIAL_STONE,
  iron:     INITIAL_IRON,
  gold:     INITIAL_GOLD,
  chickens: {},
  cows:     {},
  sheep:    {},
  equipment: { ...INITIAL_EQUIPMENT },
  baseStats: { ...INITIAL_BASE_STATS },
  stats:     computeStats(INITIAL_BASE_STATS, INITIAL_EQUIPMENT),
  skills:    { ...INITIAL_SKILLS },
  bonus:     { ...INITIAL_BONUS },
  ownedCollectibles: [],
  stamina:   { current: 100, max: 100 },
  lastStaminaRegenAt: Date.now(),
  fishing: {
    lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0,
    totalCasts: 0, totalCaught: 0,
  },
  cooking:      null,
  activity:     {},
  achievements: {},
  halvingMultiplier: 1,   // Genesis default; hydrated from /api/game-stats on load
};

/**
 * app/test-modals/mockup-data.ts
 *
 * Centralised mock data for all modal test harnesses.
 * Import from here in each modal stub — never inline magic values.
 *
 * Organised by the phase they belong to (see docs/test-modals-plan.md).
 */

import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay/game";
import type { PlayerSkills } from "@/features/types/gameplay/skills";

import { createInitialEquipment } from "@/features/types/gameplay/equipment";
import { createToolInstance } from "@/features/types/gameplay/tools";
import type { EmbeddedQuest } from "@/features/types/quests";
import type { ProfileData } from "@/features/game-components/house/ProfileClient";
import type { MarketplaceListing } from "@/features/game-components/marketplace/MarketplaceScreen";

// ---------------------------------------------------------------------------
// Phase 1 — Harvest / Market / Barn / Bazaar
// ---------------------------------------------------------------------------

/** A representative GameState with crops, resources and animals populated. */
export const MOCK_GAME_STATE: GameState = {
  id: 1,
  username: "FarmerTest",
  avatarUrl: "/assets/npcs/human.png",
  farmLevel: 4,
  fields: {
    0: { name: "Potato",  plantedAt: Date.now() - 60_000    },
    1: { name: "Carrot",  plantedAt: Date.now() - 300_000   },
    2: { name: "Pumpkin", plantedAt: Date.now() - 1_800_000 },
    3: { name: "Wheat",   plantedAt: Date.now() - 3_600_000 },
  },
  trees: {
    0: { name: "Wood", choppedAt: 0 },
    1: { name: "Wood", choppedAt: 0 },
  },
  stones: {
    0: { name: "Stone", minedAt: 0 },
  },
  chickens: {
    0: { fedAt: Date.now() - 7_200_000 },
    1: { fedAt: undefined },
  },
  cows: {
    0: { fedAt: Date.now() - 3_600_000 },
  },
  sheep: {
    0: { fedAt: undefined },
  },
  items: {
    Potato:  new Decimal(24),
    Carrot:  new Decimal(10),
    Pumpkin: new Decimal(6),
    Cabbage: new Decimal(3),
    Wheat:   new Decimal(8),
    Wood:    new Decimal(45),
    Stone:   new Decimal(30),
    Iron:    new Decimal(12),
    Shard:   new Decimal(20),
    Fish:    new Decimal(7),
    "Cabbage Roll": new Decimal(2),
    "Pumpkin Soup": new Decimal(1),
    Egg:  new Decimal(14),
    Milk: new Decimal(9),
    Wool: new Decimal(11),
    Chicken: new Decimal(2),
    Cow:     new Decimal(1),
    Sheep:   new Decimal(1),
  },
  tools: [
    createToolInstance("Axe",          "Wood"),
    createToolInstance("Pickaxe",      "Wood"),
    createToolInstance("Rod",          "Wood"),
    createToolInstance("Watering Can", "Wood"),
  ],
  farmAddress: "0xDEADBEEF00000000000000000000000000000001",
  skills: {
    farming:     840,
    woodcutting: 500,
    mining:      210,
    fishing:     90,
    husbandry:   320,
    cooking:     0,
    smithing:    0,
  },
  equipment: createInitialEquipment(),
  fishing: {
    lastCastAt:     Date.now() - 120_000,
    lastCaughtFish: "Fish",
  },
  coins:         new Decimal(0),
  stamina:       100,
  staminaRegenAt: Date.now(),
  milestones: {
    "Potato Harvested":  24,
    "Carrot Harvested":  10,
    "Tree Chopped":      7,
    "Stone Mined":       12,
    "Fish Caught":       30,
    "Egg Collected":     14,
  },
  quests: {
    daily: [],
  },
};

// ---------------------------------------------------------------------------
// Phase 2 — Quest Keeper
// ---------------------------------------------------------------------------

/** Shared mock inventory for quest completion checks. */
export const MOCK_INVENTORY: Record<string, number> = {
  Potato:  24,
  Carrot:  10,
  Pumpkin:  6,
  Cabbage:  3,
  Wood:    45,
  Stone:   30,
  Iron:    12,
  Fish:     7,
  Egg:     14,
  Milk:     9,
  Wool:    11,
  "Pumpkin Soup": 1,
};

/** Six mock daily quests — one per category, mix of states. */
export const MOCK_DAILY_QUESTS: EmbeddedQuest[] = [
  {
    id:         "mock-daily-1",
    category:   "farming",
    difficulty: "easy",
    status:     "active",
    objective:  { resource: "Potato", required: 10 },
    rewards:    { skillXp: 50  },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 18 * 60 * 60 * 1000,
  },
  {
    id:         "mock-daily-2",
    category:   "mining",
    difficulty: "normal",
    status:     "active",
    objective:  { resource: "Stone", required: 8 },
    rewards:    { skillXp: 150 },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 16 * 60 * 60 * 1000,
  },
  {
    id:         "mock-daily-3",
    category:   "woodcutting",
    difficulty: "hard",
    status:     "active",
    // requires 30 Wood; player has 45 — canClaim = true
    objective:  { resource: "Wood", required: 30 },
    rewards:    { skillXp: 400 },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 14 * 60 * 60 * 1000,
  },
  {
    id:         "mock-daily-4",
    category:   "fishing",
    difficulty: "easy",
    status:     "completed",
    objective:  { resource: "Anchovy", required: 5 },
    rewards:    { skillXp: 50  },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 20 * 60 * 60 * 1000,
    completedAt: Date.now() - 3 * 60 * 60 * 1000,
  },
  {
    id:         "mock-daily-5",
    category:   "mining",
    difficulty: "normal",
    status:     "active",
    // requires 20 Iron; player has 12 — canClaim = false (tests deficit)
    objective:  { resource: "Iron", required: 20 },
    rewards:    { skillXp: 150 },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 12 * 60 * 60 * 1000,
  },
  {
    id:         "mock-daily-6",
    category:   "husbandry",
    difficulty: "easy",
    status:     "active",
    // requires 8 Egg; player has 14 — canClaim = true
    objective:  { resource: "Egg", required: 8 },
    rewards:    { skillXp: 50  },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 22 * 60 * 60 * 1000,
  },
];


// ---------------------------------------------------------------------------
// Phase 3 — Fish Caught
// ---------------------------------------------------------------------------

export const MOCK_WALLET = "0xTestWallet0000000000000000000000000000001";

export const MOCK_FISH_CAUGHT = {
  fish:   "Fish" as const,
  amount: 2,
};

// ---------------------------------------------------------------------------
// Phase 4 — Vault / Hall of Fame / Marketplace
// ---------------------------------------------------------------------------

/**
 * Big recent sales — reshaped into the "Top Sales" strip on the fullscreen
 * Marketplace (docs/modal-redesign-plan.md §2.4, Phase C).
 */
export const MOCK_WHALE_TRADERS = [
  { item: "Celestial Ribbit",  buyer: "EvilBread",  avatar: "/assets/npcs/human.png", price: 27000, usd: "$1879.23" },
  { item: "Legendary Egg",     buyer: "Dokdo",      avatar: "/assets/npcs/human.png", price: 18800, usd: "$1308.50" },
  { item: "Ember Hopper",      buyer: "Kerim",      avatar: "/assets/npcs/human.png", price: 14500, usd: "$1009.21" },
  { item: "Epic Shard x10",    buyer: "vanyard",    avatar: "/assets/npcs/human.png", price: 12800, usd: "$890.69" },
  { item: "Forest Sage",       buyer: "EvilBread",  avatar: "/assets/npcs/human.png", price: 12000, usd: "$835.21" },
];

/** Ticker footer stats for the fullscreen Marketplace. */
export const MOCK_MARKETPLACE_STATS = {
  totalVolume: "116.5B coins",
  totalTrades: "27,729,316",
  walletsHolding: "763,301",
};

/**
 * Mock listings for the fullscreen Marketplace card grid
 * (docs/modal-redesign-plan.md §2.4). Shape matches MarketplaceListing
 * in components/game/MarketplaceScreen.tsx.
 */
export const MOCK_MARKETPLACE_LISTINGS: MarketplaceListing[] = [
  { id: "m-09", name: "Gold Ore",        category: "resource",          price: 780,  usd: "$54.29",  image: "/assets/resources/gold_ore.png",   seller: "mossy",     featured: true },
  { id: "m-10", name: "Iron Ore",        category: "resource",          price: 260,  usd: "$18.10",  image: "/assets/resources/iron_ore.png",   seller: "EvilBread" },
  { id: "m-11", name: "Stone",           category: "resource",          price: 60,   usd: "$4.18",   image: "/assets/resources/stone.png",      seller: "Kerim" },
  { id: "m-12", name: "Potato Seed",     category: "seed",              price: 25,   usd: "$1.74",   image: "/assets/crops/potato/seed.png",    seller: "Dokdo" },
  { id: "m-13", name: "Pumpkin Seed",    category: "seed",              price: 90,   usd: "$6.26",   image: "/assets/crops/pumpkin/seed.png",   seller: "vanyard" },
  { id: "m-14", name: "Pumpkin Soup",    category: "food",              price: 140,  usd: "$9.74",   image: "/assets/foods/pumpkin_soup.png",   seller: "mossy",     featured: true },
  { id: "m-15", name: "Roasted Potato",  category: "food",              price: 55,   usd: "$3.83",   image: "/assets/foods/roasted_potato.png", seller: "Kerim" },
  { id: "m-20", name: "Tilapia",         category: "fish",              price: 45,   usd: "$3.13",   image: "/assets/fish/fish.png",            seller: "vanyard" },
  { id: "m-21", name: "Trout",           category: "fish",              price: 120,  usd: "$8.35",   image: "/assets/fish/fish.png",            seller: "EvilBread", featured: true },
  { id: "m-22", name: "Wood",            category: "crafting_material", price: 18,   usd: "$1.25",   image: "/assets/resources/wood.png",       seller: "mossy" },
];

// ---------------------------------------------------------------------------
// Phase 5 — House / Wallet
// ---------------------------------------------------------------------------

export const MOCK_WALLET_BALANCE = {};

/** Mock profile for the House modal Player tab in the test harness. */
export const MOCK_PROFILE_DATA: ProfileData = {
  wallet:           "0xTestWallet0000000000000000000000000000001",
  username:         "FarmerTest",
  registrationTime: new Date("2024-03-15").getTime(),
  skills: {
    farming:     4200,
    woodcutting: 1850,
    mining:      3100,
    fishing:     920,
    husbandry:   680,
    cooking:     0,
    smithing:    0,
  },
};



// ---------------------------------------------------------------------------
// Phase 6 — Avatar Menu (Music · Skills · Gear) · Inventory
// ---------------------------------------------------------------------------

/**
 * Mock PlayerSkills (raw XP per category) for AvatarMenuMockShell.
 * Maps directly to useGameStore state.skills — same shape as INITIAL_SKILLS.
 */
export const MOCK_SKILLS: PlayerSkills = {
  farming:     4200,
  woodcutting: 1850,
  mining:      3100,
  fishing:     920,
  husbandry:   680,
  cooking:     0,
  smithing:    0,
};

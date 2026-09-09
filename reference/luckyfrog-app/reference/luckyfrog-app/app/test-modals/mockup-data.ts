/**
 * app/test-modals/mockup-data.ts
 *
 * Centralised mock data for all modal test harnesses.
 * Import from here in each modal stub — never inline magic values.
 *
 * Organised by the phase they belong to (see docs/test-modals-plan.md).
 */

import Decimal from "decimal.js-light";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_EQUIPMENT, INITIAL_BASE_STATS } from "@/shared/types/gameplay/equipment";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import type { PlayerSkills } from "@/shared/types/gameplay/skills";
import type { PlayerEquipment } from "@/shared/types/gameplay/equipment";
import type { EmbeddedQuest } from "@/shared/types/quests";
import type { MarketplaceListing } from "@/components/game/marketplace/MarketplaceScreen";

// ---------------------------------------------------------------------------
// Phase 1 — Harvest / Market / Barn / Bazaar
// ---------------------------------------------------------------------------

/** A representative GameState with crops, resources and animals populated. */
export const MOCK_GAME_STATE: GameState = {
  id: 1,
  username: "FarmerTest",
  avatarUrl: "/assets/npcs/human.png",
  balance: new Decimal(1250.75),
  fields: {
    0: { name: "Potato",  plantedAt: Date.now() - 60_000,  amount: 3 },
    1: { name: "Carrot",  plantedAt: Date.now() - 300_000, amount: 5 },
    2: { name: "Pumpkin", plantedAt: Date.now() - 1_800_000, amount: 2 },
    3: { name: "Beetroot",plantedAt: Date.now() - 3_600_000, amount: 4 },
  },
  trees: {
    0: { name: "Wood", choppedAt: undefined, amount: 8 },
    1: { name: "Wood", choppedAt: undefined, amount: 3 },
  },
  stones: {
    0: { name: "Stone", minedAt: undefined, amount: 12 },
  },
  iron: {
    0: { name: "Iron", minedAt: undefined, amount: 5 },
  },
  gold: {
    0: { name: "Gold", minedAt: undefined, amount: 2 },
  },
  chickens: {
    0: { fedAt: Date.now() - 7_200_000, multiplier: 1 },
    1: { fedAt: undefined, multiplier: 1 },
  },
  cows: {
    0: { fedAt: Date.now() - 3_600_000, multiplier: 1.5 },
  },
  sheep: {
    0: { fedAt: undefined, multiplier: 1 },
  },
  inventory: {
    Potato:    new Decimal(24),
    Carrot:    new Decimal(10),
    Pumpkin:   new Decimal(6),
    Cabbage:   new Decimal(3),
    Beetroot:  new Decimal(8),
    Wood:      new Decimal(45),
    Stone:     new Decimal(30),
    Iron:      new Decimal(12),
    Gold:      new Decimal(4),
    Anchovy:   new Decimal(7),
    Sardine:   new Decimal(3),
    "Cabbage Roll": new Decimal(2),
    "Pumpkin Soup": new Decimal(1),
    Egg:       new Decimal(14),
    Milk:      new Decimal(9),
    Wool:      new Decimal(11),
  },
  farmAddress: "0xDEADBEEF00000000000000000000000000000001",
  // §C5 — canonical 5-slot equipment (avatar | weapon | armor | mount | accessory)
  equipment: INITIAL_EQUIPMENT,
  // §C5 — six core frog stats (dodge/damage/defense/mining/crit/luck), dormant in Gen One
  baseStats: INITIAL_BASE_STATS,
  stats: INITIAL_BASE_STATS,
  // §C5 — PlayerSkills is raw XP per category; forestry → woodcutting; combat stored/inactive
  skills: {
    farming:     840,
    woodcutting: 500,
    mining:      210,
    fishing:     90,
    cooking:     150,
    combat:      0,   // inactive (stored XP only, §5.8)
    husbandry:   320,
  },
  bonus: INITIAL_BONUS,
  ownedCollectibles: [],
  stamina: { current: 82, max: 100 },
  lastStaminaRegenAt: Date.now() - 60_000,
  fishing: {
    lastCastAt:       Date.now() - 120_000,
    lastCaughtFish:   "Anchovy",
    lastCaughtAmount: 2,
    totalCasts:       37,
    totalCaught:      30,
  },
  cooking: null,
  activity: {
    "Potato Harvested":  24,
    "Carrot Harvested":  10,
    "Tree Chopped":      7,
    "Stone Mined":       12,
    "Fish Caught":       30,
    "Egg Collected":     14,
  },
  achievements: {
    "First Harvest":     1,
    "Master Farmer":     0,
    "Lumberjack":        1,
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
  Anchovy:  7,
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
    rewards:    { guaranteedShards: [{ amount: 2 }], skillXp: 50, baseRolls: 2 },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 18 * 60 * 60 * 1000,
  },
  {
    id:         "mock-daily-2",
    category:   "mining",
    difficulty: "normal",
    status:     "active",
    objective:  { resource: "Stone", required: 8 },
    rewards:    { guaranteedShards: [{ amount: 5 }], skillXp: 150, baseRolls: 4 },
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
    rewards:    { guaranteedShards: [{ amount: 10 }], skillXp: 400, baseRolls: 6 },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 14 * 60 * 60 * 1000,
  },
  {
    id:         "mock-daily-4",
    category:   "fishing",
    difficulty: "easy",
    status:     "completed",
    objective:  { resource: "Anchovy", required: 5 },
    rewards:    { guaranteedShards: [{ amount: 2 }], skillXp: 50, baseRolls: 2 },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 20 * 60 * 60 * 1000,
    completedAt: Date.now() - 3 * 60 * 60 * 1000,
  },
  {
    id:         "mock-daily-5",
    category:   "cooking",
    difficulty: "normal",
    status:     "active",
    // requires 3 Pumpkin Soup; player has 1 — canClaim = false (tests deficit)
    objective:  { resource: "Pumpkin Soup", required: 3 },
    rewards:    { guaranteedShards: [{ amount: 5 }], skillXp: 150, baseRolls: 4 },
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
    rewards:    { guaranteedShards: [{ amount: 2 }], skillXp: 50, baseRolls: 2 },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 22 * 60 * 60 * 1000,
  },
];

export const MOCK_WEEKLY_QUESTS: EmbeddedQuest[] = [
  {
    id:         "mock-weekly-1",
    category:   "farming",
    difficulty: "expert",
    status:     "active",
    // requires 50 Carrot; player has 10 — canClaim = false
    objective:  { resource: "Carrot", required: 50 },
    rewards:    { guaranteedShards: [{ amount: 20 }], skillXp: 1000, baseRolls: 8 },
    generatedAt: Date.now(),
    expiresAt:   Date.now() + 6 * 24 * 60 * 60 * 1000,
  },
];

// ---------------------------------------------------------------------------
// Phase 3 — Fish Caught
// ---------------------------------------------------------------------------

export const MOCK_WALLET = "0xTestWallet0000000000000000000000000000001";

export const MOCK_FISH_CAUGHT = {
  fish:   "Tilapia" as const,
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
  totalVolume: "116.5B LFRG",
  totalTrades: "27,729,316",
  walletsHolding: "763,301",
};

/**
 * Mock listings for the fullscreen Marketplace card grid
 * (docs/modal-redesign-plan.md §2.4). Shape matches MarketplaceListing
 * in components/game/MarketplaceScreen.tsx.
 */
// §C6 — categories re-mapped to the Phase 4 TRADABLE_ASSET_TYPES. Tool listings
// removed (tools do not exist, §4.13/§5.6). Egg listings removed — eggs are bought
// from the Hatchery treasury shop, not player-listed. Replaced with representative
// Gen One assets: equipment, seeds, food, frog shards, frogments, and fish.
export const MOCK_MARKETPLACE_LISTINGS: MarketplaceListing[] = [
  { id: "m-01", name: "Ember Hopper",     category: "frog",              rarity: "epic",      price: 12400, usd: "$862.95",  image: "/assets/frogs/ember-hopper.png",     seller: "EvilBread", featured: true },
  { id: "m-02", name: "Celestial Ribbit", category: "frog",              rarity: "legendary", price: 48000, usd: "$3340.80", image: "/assets/frogs/celestial-ribbit.png", seller: "Dokdo",     featured: true },
  { id: "m-03", name: "Forest Sage",      category: "frog",              rarity: "rare",      price: 5600,  usd: "$389.76",  image: "/assets/frogs/forest-sage.png",      seller: "Kerim" },
  { id: "m-04", name: "Dusk Caller",      category: "frog",              rarity: "uncommon",  price: 1150,  usd: "$80.04",   image: "/assets/frogs/dusk-caller.png",      seller: "vanyard" },
  { id: "m-05", name: "Bog Wanderer",     category: "frog",              rarity: "uncommon",  price: 320,   usd: "$22.27",   image: "/assets/frogs/bog-wanderer.png",     seller: "mossy" },
  { id: "m-06", name: "Ashclaw",          category: "frog",              rarity: "epic",      price: 15800, usd: "$1099.68", image: "/assets/frogs/ashclaw.png",          seller: "Dokdo" },
  { id: "m-07", name: "Warrior Avatar",   category: "equipment",         rarity: "rare",      price: 2100,  usd: "$146.16",  image: "/assets/frogs/ember-witch.png",      seller: "Kerim",     featured: true },
  { id: "m-08", name: "Lucky Charm",      category: "equipment",         rarity: "uncommon",  price: 900,   usd: "$62.64",   image: "/assets/icons/heart.png",            seller: "Dokdo" },
  { id: "m-09", name: "Gold Ore",         category: "resource",          rarity: "rare",      price: 780,   usd: "$54.29",   image: "/assets/resources/gold_ore.png",     seller: "mossy",     featured: true },
  { id: "m-10", name: "Iron Ore",         category: "resource",          rarity: "uncommon",  price: 260,   usd: "$18.10",   image: "/assets/resources/iron_ore.png",     seller: "EvilBread" },
  { id: "m-11", name: "Stone",            category: "resource",          rarity: "common",    price: 60,    usd: "$4.18",    image: "/assets/resources/stone.png",        seller: "Kerim" },
  { id: "m-12", name: "Potato Seed",      category: "seed",              rarity: "common",    price: 25,    usd: "$1.74",    image: "/assets/crops/potato/seed.png",      seller: "Dokdo" },
  { id: "m-13", name: "Pumpkin Seed",     category: "seed",              rarity: "uncommon",  price: 90,    usd: "$6.26",    image: "/assets/crops/pumpkin/seed.png",     seller: "vanyard" },
  { id: "m-14", name: "Pumpkin Soup",     category: "food",              rarity: "uncommon",  price: 140,   usd: "$9.74",    image: "/assets/foods/pumpkin_soup.png",     seller: "mossy",     featured: true },
  { id: "m-15", name: "Roasted Potato",   category: "food",              rarity: "common",    price: 55,    usd: "$3.83",    image: "/assets/foods/roasted_potato.png",   seller: "Kerim" },
  { id: "m-19", name: "Frogment",         category: "frogment",          rarity: "common",    price: 12,    usd: "$0.83",    image: "/assets/icons/luckyfrog_token.png",  seller: "Dokdo" },
  { id: "m-20", name: "Tilapia",          category: "fish",              rarity: "common",    price: 45,    usd: "$3.13",    image: "/assets/fish/fish.png",              seller: "vanyard" },
];

// ---------------------------------------------------------------------------
// Phase 5 — Bank / House / Wallet
// ---------------------------------------------------------------------------

export const MOCK_WALLET_BALANCE = {
  lfrg:    4200.5,
  lfrgUsd: 0.0696,
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
  woodcutting: 1850,  // §C5 — renamed from forestry
  mining:      3100,
  fishing:     920,
  cooking:     2400,
  combat:      5800,  // inactive (stored XP only, §5.8)
  husbandry:   680,
};

/**
 * Mock PlayerEquipment for AvatarMenuMockShell.
 * §C5 — canonical 5-slot list (weapon | armor | mount | accessory | special);
 * `avatar` was removed in §C5; `special` added for unique/seasonal items.
 * Attributes mirror the six core frog stats (dormant in Gen One, §5.8).
 */
export const MOCK_EQUIPMENT: PlayerEquipment = {
  weapon: {
    item_number:   42,
    item_id:       "iron-pickaxe",
    item_equipped: true,
    attributes:    { dodge: 0, damage: 12, defense: 0, mining: 5, crit: 2, luck: 0 },
  },
  armor: {
    item_number:   null,
    item_id:       null,
    item_equipped: false,
    attributes:    { dodge: 0, damage: 0, defense: 0, mining: 0, crit: 0, luck: 0 },
  },
  mount: {
    item_number:   null,
    item_id:       null,
    item_equipped: false,
    attributes:    { dodge: 0, damage: 0, defense: 0, mining: 0, crit: 0, luck: 0 },
  },
  accessory: {
    item_number:   3,
    item_id:       "lucky-charm",
    item_equipped: true,
    attributes:    { dodge: 1, damage: 0, defense: 2, mining: 0, crit: 0, luck: 5 },
  },
  special: {
    item_number:   7,
    item_id:       "frog-warrior",
    item_equipped: true,
    attributes:    { dodge: 2, damage: 0, defense: 0, mining: 0, crit: 1, luck: 3 },
  },
};

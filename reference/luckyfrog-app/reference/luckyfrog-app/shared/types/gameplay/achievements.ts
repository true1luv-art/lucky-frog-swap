import Decimal from "decimal.js-light";
import { GameState } from "@/shared/types/gameplay/game";
import { getSkillLevel } from "@/shared/game/skills";

export type ActivityName =
  | "Crop Harvested"
  | "Potato Harvested"
  | "Carrot Harvested"
  | "Cabbage Harvested"
  | "Pumpkin Harvested"
  | "Beetroot Harvested"
  | "Parsnip Harvested"
  | "Radish Harvested"
  | "Cauliflower Harvested"
  | "Wheat Harvested"
  | "Kale Harvested"
  | "Tree Chopped"
  | "Stone Mined"
  | "Iron Mined"
  | "Gold Mined"
  | "Animal Fed"
  | "Egg Collected"
  | "Milk Collected"
  | "Wool Collected"
  | "Fish Caught"
  | "Coins Earned"
  | "Coins Spent";

export type Activity = Partial<Record<ActivityName, number>>;

export type AchievementCategory =
  | "farming" | "animals" | "gathering" | "economy" | "progression";

export type Achievement = {
  name: string;
  description: string;
  category: AchievementCategory;
  progress: (state: GameState) => number;
  requirement: number;
  hidden?: boolean;
  requires?: AchievementName[];
};

export type AchievementName =
  | "First Harvest" | "Budding Farmer" | "Field Worker" | "Crop Master"
  | "Harvest Legend" | "Eternal Farmer"
  | "Spud Specialist" | "Carrot Commander" | "Cabbage Cultivator"
  | "Pumpkin Prince" | "Beet Baron" | "Wheat Whisperer" | "Kale King"
  | "All-Rounder" | "Crop Perfectionist"
  | "Animal Friend" | "Caretaker" | "Animal Whisperer" | "Barnyard Boss"
  | "Egg Collector" | "Egg Enthusiast" | "Egg Empire"
  | "Dairy Devotee" | "Milk Magnate" | "Wool Gatherer" | "Wool Wizard"
  | "First Chop" | "Woodcutter" | "Lumberjack" | "Forest Fury"
  | "Rock Breaker" | "Quarry Worker" | "Stone Seeker" | "Mountain Mover"
  | "Iron Finder" | "Iron Worker" | "Iron Heart"
  | "Gold Digger" | "Gold Rush" | "Golden Touch"
  | "First Sale" | "Merchant" | "Trader" | "Wealthy Farmer" | "Tycoon"
  | "Big Spender" | "High Roller" | "Coin Hoarder"
  | "Seedling" | "Sprouting" | "Green Thumb" | "Crop Tender" | "Field Hand"
  | "Farm Hand" | "Crop Expert" | "Harvest Master" | "Crop Veteran" | "Master Farmer"
  | "Tree Hugger" | "Wood Gatherer" | "Axe Apprentice" | "Woodcutter Pro"
  | "Forest Worker" | "Timber Expert" | "Forest Ranger" | "Wood Master"
  | "Forest Veteran" | "Master Lumberjack"
  | "Pebble Picker" | "Stone Handler" | "Mine Apprentice" | "Ore Seeker"
  | "Mine Expert" | "Rock Veteran" | "Ore Master" | "Deep Miner" | "Master Miner"
  | "Animal Apprentice" | "Animal Keeper" | "Animal Tender" | "Herd Handler"
  | "Animal Expert" | "Barn Manager" | "Herd Master" | "Animal Veteran" | "Master Herder"
  | "First Meal" | "Home Cook" | "Kitchen Helper" | "Recipe Learner" | "Sous Chef"
  | "Line Cook" | "Head Chef" | "Culinary Expert" | "Master Chef" | "Legendary Chef"
  | "First Fight" | "Brawler" | "Street Fighter" | "Warrior Initiate"
  | "Battle Hardened" | "Combat Expert" | "Veteran Fighter" | "Elite Warrior"
  | "War Hero" | "Master Warrior"
  | "First Cast" | "Pond Fisher" | "River Fisher" | "Patient Angler"
  | "Skilled Angler" | "Lake Fisher" | "Deep Sea Fisher" | "Expert Angler"
  | "Fishing Veteran" | "Master Angler"
  | "Night Owl" | "Speed Farmer" | "Empty Pockets" | "Full Barn" | "Resource Millionaire";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getActivity = (state: GameState, name: ActivityName): number =>
  state.activity?.[name] ?? 0;

const getCropsHarvested = (state: GameState): number =>
  getActivity(state, "Crop Harvested");

const getUniqueAnimalTypes = (state: GameState): number => {
  let count = 0;
  if (Object.keys(state.chickens).length > 0) count++;
  if (Object.keys(state.cows).length > 0) count++;
  if (Object.keys(state.sheep).length > 0) count++;
  return count;
};

const getCropTypesHarvested = (state: GameState): number => {
  const names: ActivityName[] = [
    "Potato Harvested", "Carrot Harvested", "Cabbage Harvested",
    "Pumpkin Harvested", "Beetroot Harvested", "Parsnip Harvested",
    "Radish Harvested", "Cauliflower Harvested", "Wheat Harvested", "Kale Harvested",
  ];
  return names.filter((n) => getActivity(state, n) > 0).length;
};

const allCropsHarvested100 = (state: GameState): number => {
  const names: ActivityName[] = [
    "Potato Harvested", "Carrot Harvested", "Cabbage Harvested",
    "Pumpkin Harvested", "Beetroot Harvested", "Parsnip Harvested",
    "Radish Harvested", "Cauliflower Harvested", "Wheat Harvested", "Kale Harvested",
  ];
  return Math.min(...names.map((n) => getActivity(state, n)));
};

// ---------------------------------------------------------------------------
// Achievement definitions
// ---------------------------------------------------------------------------

export const ACHIEVEMENTS: Record<AchievementName, Achievement> = {
  "First Harvest":        { name: "First Harvest", description: "Harvest your first crop", category: "farming", progress: getCropsHarvested, requirement: 1 },
  "Budding Farmer":       { name: "Budding Farmer", description: "Harvest 100 crops", category: "farming", progress: getCropsHarvested, requirement: 100, requires: ["First Harvest"] },
  "Field Worker":         { name: "Field Worker", description: "Harvest 500 crops", category: "farming", progress: getCropsHarvested, requirement: 500, requires: ["Budding Farmer"] },
  "Crop Master":          { name: "Crop Master", description: "Harvest 2,500 crops", category: "farming", progress: getCropsHarvested, requirement: 2500, requires: ["Field Worker"] },
  "Harvest Legend":       { name: "Harvest Legend", description: "Harvest 10,000 crops", category: "farming", progress: getCropsHarvested, requirement: 10000, requires: ["Crop Master"] },
  "Eternal Farmer":       { name: "Eternal Farmer", description: "Harvest 100,000 crops", category: "farming", progress: getCropsHarvested, requirement: 100000, requires: ["Harvest Legend"] },
  "Spud Specialist":      { name: "Spud Specialist", description: "Harvest 1,000 Potatoes", category: "farming", progress: (s) => getActivity(s, "Potato Harvested"), requirement: 1000 },
  "Carrot Commander":     { name: "Carrot Commander", description: "Harvest 1,000 Carrots", category: "farming", progress: (s) => getActivity(s, "Carrot Harvested"), requirement: 1000 },
  "Cabbage Cultivator":   { name: "Cabbage Cultivator", description: "Harvest 500 Cabbages", category: "farming", progress: (s) => getActivity(s, "Cabbage Harvested"), requirement: 500 },
  "Pumpkin Prince":       { name: "Pumpkin Prince", description: "Harvest 500 Pumpkins", category: "farming", progress: (s) => getActivity(s, "Pumpkin Harvested"), requirement: 500 },
  "Beet Baron":           { name: "Beet Baron", description: "Harvest 250 Beetroots", category: "farming", progress: (s) => getActivity(s, "Beetroot Harvested"), requirement: 250 },
  "Wheat Whisperer":      { name: "Wheat Whisperer", description: "Harvest 100 Wheat", category: "farming", progress: (s) => getActivity(s, "Wheat Harvested"), requirement: 100 },
  "Kale King":            { name: "Kale King", description: "Harvest 50 Kale", category: "farming", progress: (s) => getActivity(s, "Kale Harvested"), requirement: 50 },
  "All-Rounder":          { name: "All-Rounder", description: "Harvest every crop type at least once", category: "farming", progress: getCropTypesHarvested, requirement: 10 },
  "Crop Perfectionist":   { name: "Crop Perfectionist", description: "Harvest 100 of every crop type", category: "farming", progress: allCropsHarvested100, requirement: 100, requires: ["All-Rounder"] },
  "Animal Friend":        { name: "Animal Friend", description: "Feed an animal for the first time", category: "animals", progress: (s) => getActivity(s, "Animal Fed"), requirement: 1 },
  "Caretaker":            { name: "Caretaker", description: "Feed animals 100 times", category: "animals", progress: (s) => getActivity(s, "Animal Fed"), requirement: 100, requires: ["Animal Friend"] },
  "Animal Whisperer":     { name: "Animal Whisperer", description: "Feed animals 1,000 times", category: "animals", progress: (s) => getActivity(s, "Animal Fed"), requirement: 1000, requires: ["Caretaker"] },
  "Barnyard Boss":        { name: "Barnyard Boss", description: "Own at least one of each animal type", category: "animals", progress: getUniqueAnimalTypes, requirement: 3 },
  "Egg Collector":        { name: "Egg Collector", description: "Collect 100 Eggs", category: "animals", progress: (s) => getActivity(s, "Egg Collected"), requirement: 100 },
  "Egg Enthusiast":       { name: "Egg Enthusiast", description: "Collect 1,000 Eggs", category: "animals", progress: (s) => getActivity(s, "Egg Collected"), requirement: 1000, requires: ["Egg Collector"] },
  "Egg Empire":           { name: "Egg Empire", description: "Collect 10,000 Eggs", category: "animals", progress: (s) => getActivity(s, "Egg Collected"), requirement: 10000, requires: ["Egg Enthusiast"] },
  "Dairy Devotee":        { name: "Dairy Devotee", description: "Collect 500 Milk", category: "animals", progress: (s) => getActivity(s, "Milk Collected"), requirement: 500 },
  "Milk Magnate":         { name: "Milk Magnate", description: "Collect 5,000 Milk", category: "animals", progress: (s) => getActivity(s, "Milk Collected"), requirement: 5000, requires: ["Dairy Devotee"] },
  "Wool Gatherer":        { name: "Wool Gatherer", description: "Collect 500 Wool", category: "animals", progress: (s) => getActivity(s, "Wool Collected"), requirement: 500 },
  "Wool Wizard":          { name: "Wool Wizard", description: "Collect 5,000 Wool", category: "animals", progress: (s) => getActivity(s, "Wool Collected"), requirement: 5000, requires: ["Wool Gatherer"] },
  "First Chop":           { name: "First Chop", description: "Chop your first tree", category: "gathering", progress: (s) => getActivity(s, "Tree Chopped"), requirement: 1 },
  "Woodcutter":           { name: "Woodcutter", description: "Chop 50 trees", category: "gathering", progress: (s) => getActivity(s, "Tree Chopped"), requirement: 50, requires: ["First Chop"] },
  "Lumberjack":           { name: "Lumberjack", description: "Chop 500 trees", category: "gathering", progress: (s) => getActivity(s, "Tree Chopped"), requirement: 500, requires: ["Woodcutter"] },
  "Forest Fury":          { name: "Forest Fury", description: "Chop 5,000 trees", category: "gathering", progress: (s) => getActivity(s, "Tree Chopped"), requirement: 5000, requires: ["Lumberjack"] },
  "Rock Breaker":         { name: "Rock Breaker", description: "Mine your first stone", category: "gathering", progress: (s) => getActivity(s, "Stone Mined"), requirement: 1 },
  "Quarry Worker":        { name: "Quarry Worker", description: "Mine 50 stone rocks", category: "gathering", progress: (s) => getActivity(s, "Stone Mined"), requirement: 50, requires: ["Rock Breaker"] },
  "Stone Seeker":         { name: "Stone Seeker", description: "Mine 500 stone rocks", category: "gathering", progress: (s) => getActivity(s, "Stone Mined"), requirement: 500, requires: ["Quarry Worker"] },
  "Mountain Mover":       { name: "Mountain Mover", description: "Mine 5,000 stone rocks", category: "gathering", progress: (s) => getActivity(s, "Stone Mined"), requirement: 5000, requires: ["Stone Seeker"] },
  "Iron Finder":          { name: "Iron Finder", description: "Mine your first iron", category: "gathering", progress: (s) => getActivity(s, "Iron Mined"), requirement: 1 },
  "Iron Worker":          { name: "Iron Worker", description: "Mine 100 iron rocks", category: "gathering", progress: (s) => getActivity(s, "Iron Mined"), requirement: 100, requires: ["Iron Finder"] },
  "Iron Heart":           { name: "Iron Heart", description: "Mine 1,000 iron rocks", category: "gathering", progress: (s) => getActivity(s, "Iron Mined"), requirement: 1000, requires: ["Iron Worker"] },
  "Gold Digger":          { name: "Gold Digger", description: "Mine your first gold", category: "gathering", progress: (s) => getActivity(s, "Gold Mined"), requirement: 1 },
  "Gold Rush":            { name: "Gold Rush", description: "Mine 50 gold rocks", category: "gathering", progress: (s) => getActivity(s, "Gold Mined"), requirement: 50, requires: ["Gold Digger"] },
  "Golden Touch":         { name: "Golden Touch", description: "Mine 500 gold rocks", category: "gathering", progress: (s) => getActivity(s, "Gold Mined"), requirement: 500, requires: ["Gold Rush"] },
  "First Sale":           { name: "First Sale", description: "Sell your first item", category: "economy", progress: (s) => getActivity(s, "Coins Earned"), requirement: 1 },
  "Merchant":             { name: "Merchant", description: "Earn 100 coins total", category: "economy", progress: (s) => getActivity(s, "Coins Earned"), requirement: 100, requires: ["First Sale"] },
  "Trader":               { name: "Trader", description: "Earn 1,000 coins total", category: "economy", progress: (s) => getActivity(s, "Coins Earned"), requirement: 1000, requires: ["Merchant"] },
  "Wealthy Farmer":       { name: "Wealthy Farmer", description: "Earn 10,000 coins total", category: "economy", progress: (s) => getActivity(s, "Coins Earned"), requirement: 10000, requires: ["Trader"] },
  "Tycoon":               { name: "Tycoon", description: "Earn 100,000 coins total", category: "economy", progress: (s) => getActivity(s, "Coins Earned"), requirement: 100000, requires: ["Wealthy Farmer"] },
  "Big Spender":          { name: "Big Spender", description: "Spend 1,000 coins total", category: "economy", progress: (s) => getActivity(s, "Coins Spent"), requirement: 1000 },
  "High Roller":          { name: "High Roller", description: "Spend 10,000 coins total", category: "economy", progress: (s) => getActivity(s, "Coins Spent"), requirement: 10000, requires: ["Big Spender"] },
  "Coin Hoarder":         { name: "Coin Hoarder", description: "Have 10,000 coins", category: "economy", progress: (s) => s.balance.toNumber(), requirement: 10000 },
  // Farming skill progression
  "Seedling":         { name: "Seedling", description: "Reach Farming Level 10", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 10 },
  "Sprouting":        { name: "Sprouting", description: "Reach Farming Level 20", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 20 },
  "Green Thumb":      { name: "Green Thumb", description: "Reach Farming Level 30", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 30 },
  "Crop Tender":      { name: "Crop Tender", description: "Reach Farming Level 40", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 40 },
  "Field Hand":       { name: "Field Hand", description: "Reach Farming Level 50", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 50 },
  "Farm Hand":        { name: "Farm Hand", description: "Reach Farming Level 60", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 60 },
  "Crop Expert":      { name: "Crop Expert", description: "Reach Farming Level 70", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 70 },
  "Harvest Master":   { name: "Harvest Master", description: "Reach Farming Level 80", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 80 },
  "Crop Veteran":     { name: "Crop Veteran", description: "Reach Farming Level 90", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 90 },
  "Master Farmer":    { name: "Master Farmer", description: "Reach Farming Level 100", category: "progression", progress: (s) => getSkillLevel(s.skills.farming), requirement: 100 },
  // Woodcutting skill progression (§C5 — renamed from forestry)
  "Tree Hugger":        { name: "Tree Hugger", description: "Reach Woodcutting Level 10", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 10 },
  "Wood Gatherer":      { name: "Wood Gatherer", description: "Reach Woodcutting Level 20", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 20 },
  "Axe Apprentice":     { name: "Axe Apprentice", description: "Reach Woodcutting Level 30", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 30 },
  "Woodcutter Pro":     { name: "Woodcutter Pro", description: "Reach Woodcutting Level 40", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 40 },
  "Forest Worker":      { name: "Forest Worker", description: "Reach Woodcutting Level 50", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 50 },
  "Timber Expert":      { name: "Timber Expert", description: "Reach Woodcutting Level 60", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 60 },
  "Forest Ranger":      { name: "Forest Ranger", description: "Reach Woodcutting Level 70", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 70 },
  "Wood Master":        { name: "Wood Master", description: "Reach Woodcutting Level 80", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 80 },
  "Forest Veteran":     { name: "Forest Veteran", description: "Reach Woodcutting Level 90", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 90 },
  "Master Lumberjack":  { name: "Master Lumberjack", description: "Reach Woodcutting Level 100", category: "progression", progress: (s) => getSkillLevel(s.skills.woodcutting), requirement: 100 },
  // Mining skill progression
  "Pebble Picker":  { name: "Pebble Picker", description: "Reach Mining Level 10", category: "progression", progress: (s) => getSkillLevel(s.skills.mining), requirement: 10 },
  "Stone Handler":  { name: "Stone Handler", description: "Reach Mining Level 20", category: "progression", progress: (s) => getSkillLevel(s.skills.mining), requirement: 20 },
  "Mine Apprentice":{ name: "Mine Apprentice", description: "Reach Mining Level 30", category: "progression", progress: (s) => getSkillLevel(s.skills.mining), requirement: 30 },
  "Ore Seeker":     { name: "Ore Seeker", description: "Reach Mining Level 40", category: "progression", progress: (s) => getSkillLevel(s.skills.mining), requirement: 40 },
  "Mine Expert":    { name: "Mine Expert", description: "Reach Mining Level 50", category: "progression", progress: (s) => getSkillLevel(s.skills.mining), requirement: 50 },
  "Rock Veteran":   { name: "Rock Veteran", description: "Reach Mining Level 60", category: "progression", progress: (s) => getSkillLevel(s.skills.mining), requirement: 60 },
  "Ore Master":     { name: "Ore Master", description: "Reach Mining Level 70", category: "progression", progress: (s) => getSkillLevel(s.skills.mining), requirement: 70 },
  "Deep Miner":     { name: "Deep Miner", description: "Reach Mining Level 80", category: "progression", progress: (s) => getSkillLevel(s.skills.mining), requirement: 80 },
  "Master Miner":   { name: "Master Miner", description: "Reach Mining Level 100", category: "progression", progress: (s) => getSkillLevel(s.skills.mining), requirement: 100 },
  // Husbandry skill progression
  "Animal Apprentice": { name: "Animal Apprentice", description: "Reach Husbandry Level 10", category: "progression", progress: (s) => getSkillLevel(s.skills.husbandry), requirement: 10 },
  "Animal Keeper":     { name: "Animal Keeper", description: "Reach Husbandry Level 20", category: "progression", progress: (s) => getSkillLevel(s.skills.husbandry), requirement: 20 },
  "Animal Tender":     { name: "Animal Tender", description: "Reach Husbandry Level 30", category: "progression", progress: (s) => getSkillLevel(s.skills.husbandry), requirement: 30 },
  "Herd Handler":      { name: "Herd Handler", description: "Reach Husbandry Level 40", category: "progression", progress: (s) => getSkillLevel(s.skills.husbandry), requirement: 40 },
  "Animal Expert":     { name: "Animal Expert", description: "Reach Husbandry Level 50", category: "progression", progress: (s) => getSkillLevel(s.skills.husbandry), requirement: 50 },
  "Barn Manager":      { name: "Barn Manager", description: "Reach Husbandry Level 60", category: "progression", progress: (s) => getSkillLevel(s.skills.husbandry), requirement: 60 },
  "Herd Master":       { name: "Herd Master", description: "Reach Husbandry Level 70", category: "progression", progress: (s) => getSkillLevel(s.skills.husbandry), requirement: 70 },
  "Animal Veteran":    { name: "Animal Veteran", description: "Reach Husbandry Level 80", category: "progression", progress: (s) => getSkillLevel(s.skills.husbandry), requirement: 80 },
  "Master Herder":     { name: "Master Herder", description: "Reach Husbandry Level 100", category: "progression", progress: (s) => getSkillLevel(s.skills.husbandry), requirement: 100 },
  // Cooking skill progression
  "First Meal":      { name: "First Meal", description: "Reach Cooking Level 10", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 10 },
  "Home Cook":       { name: "Home Cook", description: "Reach Cooking Level 20", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 20 },
  "Kitchen Helper":  { name: "Kitchen Helper", description: "Reach Cooking Level 30", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 30 },
  "Recipe Learner":  { name: "Recipe Learner", description: "Reach Cooking Level 40", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 40 },
  "Sous Chef":       { name: "Sous Chef", description: "Reach Cooking Level 50", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 50 },
  "Line Cook":       { name: "Line Cook", description: "Reach Cooking Level 60", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 60 },
  "Head Chef":       { name: "Head Chef", description: "Reach Cooking Level 70", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 70 },
  "Culinary Expert": { name: "Culinary Expert", description: "Reach Cooking Level 80", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 80 },
  "Master Chef":     { name: "Master Chef", description: "Reach Cooking Level 90", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 90 },
  "Legendary Chef":  { name: "Legendary Chef", description: "Reach Cooking Level 100", category: "progression", progress: (s) => getSkillLevel(s.skills.cooking), requirement: 100 },
  // Combat skill progression
  "First Fight":       { name: "First Fight", description: "Reach Combat Level 10", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 10 },
  "Brawler":           { name: "Brawler", description: "Reach Combat Level 20", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 20 },
  "Street Fighter":    { name: "Street Fighter", description: "Reach Combat Level 30", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 30 },
  "Warrior Initiate":  { name: "Warrior Initiate", description: "Reach Combat Level 40", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 40 },
  "Battle Hardened":   { name: "Battle Hardened", description: "Reach Combat Level 50", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 50 },
  "Combat Expert":     { name: "Combat Expert", description: "Reach Combat Level 60", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 60 },
  "Veteran Fighter":   { name: "Veteran Fighter", description: "Reach Combat Level 70", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 70 },
  "Elite Warrior":     { name: "Elite Warrior", description: "Reach Combat Level 80", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 80 },
  "War Hero":          { name: "War Hero", description: "Reach Combat Level 90", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 90 },
  "Master Warrior":    { name: "Master Warrior", description: "Reach Combat Level 100", category: "progression", progress: (s) => getSkillLevel(s.skills.combat), requirement: 100 },
  // Fishing skill progression
  "First Cast":       { name: "First Cast", description: "Reach Fishing Level 10", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 10 },
  "Pond Fisher":      { name: "Pond Fisher", description: "Reach Fishing Level 20", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 20 },
  "River Fisher":     { name: "River Fisher", description: "Reach Fishing Level 30", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 30 },
  "Patient Angler":   { name: "Patient Angler", description: "Reach Fishing Level 40", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 40 },
  "Skilled Angler":   { name: "Skilled Angler", description: "Reach Fishing Level 50", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 50 },
  "Lake Fisher":      { name: "Lake Fisher", description: "Reach Fishing Level 60", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 60 },
  "Deep Sea Fisher":  { name: "Deep Sea Fisher", description: "Reach Fishing Level 70", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 70 },
  "Expert Angler":    { name: "Expert Angler", description: "Reach Fishing Level 80", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 80 },
  "Fishing Veteran":  { name: "Fishing Veteran", description: "Reach Fishing Level 90", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 90 },
  "Master Angler":    { name: "Master Angler", description: "Reach Fishing Level 100", category: "progression", progress: (s) => getSkillLevel(s.skills.fishing), requirement: 100 },
  // Hidden
  "Night Owl":            { name: "Night Owl", description: "Play after midnight", category: "progression", hidden: true, progress: () => 0, requirement: 1 },
  "Speed Farmer":         { name: "Speed Farmer", description: "Harvest a crop within seconds of it being ready", category: "progression", hidden: true, progress: () => 0, requirement: 1 },
  "Empty Pockets":        { name: "Empty Pockets", description: "Run out of coins", category: "progression", hidden: true, progress: (s) => s.balance.toNumber() <= 0 ? 1 : 0, requirement: 1 },
  "Full Barn":            { name: "Full Barn", description: "Fill your barn with animals", category: "animals", hidden: true, progress: (s) => Object.keys(s.chickens).length + Object.keys(s.cows).length + Object.keys(s.sheep).length, requirement: 20 },
  "Resource Millionaire": { name: "Resource Millionaire", description: "Accumulate 1,000,000 total resources", category: "gathering", hidden: true, progress: (s) => Object.values(s.inventory).reduce((sum, v) => sum + (v ? new Decimal(v).toNumber() : 0), 0), requirement: 1000000 },
};

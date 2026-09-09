/**
 * lib/events/farm-action/validate.ts
 *
 * Server-safe crop and resource gathering validators. §2.3-A through §2.3-E
 *
 * Design rationale:
 * - The Phaser event handlers (plant.ts, harvest.ts, chop.ts, …) reference
 *   `screenTracker.calculate()` — a client-only anti-cheat heuristic that
 *   accesses the DOM. They cannot run on the server as-is.
 * - `processGameEvent` in events/index.ts catches all thrown errors silently,
 *   returning the original state instead of surfacing the error. The API
 *   route needs errors to propagate so they can be returned as HTTP 422.
 * - This module duplicates the *validation and state-transition* logic of the
 *   Phaser event handlers, minus `screenTracker` and minus the silent catch.
 *   It imports shared helpers (CROPS, skills, stamina, boosts, config) but
 *   never imports Phaser scene/DOM code.
 *
 * Stamina pre-step (§2.3-D):
 * - Every action first calls `applyStaminaRegen(state, createdAt)` to bring
 *   the server's stamina up to date before checking sufficiency.
 *   This mirrors the `staminaRegen` event that Phaser fires periodically.
 *
 * Reference: docs/implementation_plans/phase-02-farming-backend.md §2.3
 */

import Decimal from "decimal.js-light";
import type { GameState, GameNode } from "@/features/types/gameplay/game";
import { FOODS, FOOD_FARM_LEVEL_REQUIREMENT } from "@/features/types/gameplay/craftables";
import type { Food } from "@/features/types/gameplay/craftables";
import {
  totalSkillXp,
  FARM_LEVEL_UPGRADES,
  MAX_FARM_LEVEL,
} from "@/features/game/farm-level";
import type { CookFoodAction } from "@/features/events/cooking/cookFood";
import { CROPS }                    from "@/features/types/gameplay/crops";
import type { CropName }            from "@/features/types/gameplay/crops";
import {
  getSkillXP,
  getHarvestXP,
  getFishXP,
  getCookXP,
  getSkillLevel,
} from "@/features/game/skills";

import { trackMilestone } from "@/features/game/milestones";
import type { MilestoneName } from "@/features/types/gameplay/milestones";
import {
  isFieldUnlocked,
  getFieldLevelRequirement,
  TOTAL_FIELDS,
} from "@/features/game/fields";

import {
  TREE_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
  MINE_ACTION_MS,
  CHOP_ACTION_MS,
} from "@/features/game/resources";
import {
  calculateStaminaRegen,
  hasEnoughStamina,
  deductStamina,
  STAMINA_CONSTANTS,
} from "@/features/game/stamina";
import type { OreType } from "@/features/types/gameplay/resources";
import { ORE_TO_INGOT, SMELT_ORE_PER_INGOT, SMELT_COAL_PER_INGOT } from "@/features/events/smelt/smeltOre";
import { COAL_WOOD_COST } from "@/features/events/craft-coal/craftCoal";
import { TOOLS } from "@/features/types/gameplay/craftables";
import { TOOL_SPEED_BOOST, TOOL_CRAFT_RECIPES, createToolInstance, decrementDurability } from "@/features/types/gameplay/tools";
import type { ToolName, ToolTier } from "@/features/types/gameplay/tools";
import { PICKAXE_LOOT } from "@/features/events/mine/mine";
import type { EquipmentItem, EquipmentSlot } from "@/features/types/gameplay/equipment";
import { createInitialEquipment } from "@/features/types/gameplay/equipment";
import { getUpgradeShardCost, getDestroyShardPayout } from "@/features/game/equipment";
import { FISH_TABLE, FISHING_ACTION_MS } from "@/features/game/fishing";
import { ANIMALS_CONFIG } from "@/features/game/animals";
import { rollCatch } from "@/features/game/fishing";

// ---------------------------------------------------------------------------
// Stamina regen — applied at the top of every server validator.
// ---------------------------------------------------------------------------

/**
 * Applies any pending offline stamina regeneration to `state` before the
 * action is validated. Called at the top of every server validator so the
 * state is always up-to-date before stamina sufficiency is checked.
 */
export function applyStaminaRegen(
  state:     GameState,
  createdAt: number,
): GameState {
  const current  = typeof state.stamina === "number" ? state.stamina : STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;
  const regenAt  = typeof state.staminaRegenAt === "number" ? state.staminaRegenAt : 0;
  const max      = STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;

  const { newStamina, newRegenAt } = calculateStaminaRegen(regenAt, current, max);
  return { ...state, stamina: newStamina, staminaRegenAt: newRegenAt };
}

// ---------------------------------------------------------------------------
// §2.3-A  Server-side plant validator
// ---------------------------------------------------------------------------

const VALID_SEED_SUFFIXES = [
  "Potato Seed", "Carrot Seed", "Cabbage Seed", "Pumpkin Seed", "Wheat Seed",
] as const;

function isSeed(item: string): boolean {
  return (VALID_SEED_SUFFIXES as readonly string[]).includes(item);
}

/**
 * Server-side plant — validates and applies an `item.planted` action.
 */
export function serverPlant(
  state:     GameState,
  action:    { type: "item.planted"; item?: string; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);
  const fields = { ...s.fields };

  if (action.index < 0 || !Number.isInteger(action.index) || action.index >= TOTAL_FIELDS) {
    throw new Error("Field does not exist");
  }
  const farmLevel = s.farmLevel ?? 1;
  if (!isFieldUnlocked(action.index, farmLevel)) {
    throw new Error(
      `Field requires Farm Level ${getFieldLevelRequirement(action.index)}`,
    );
  }
  if (fields[action.index]) throw new Error("Crop is already planted");
  if (!action.item)         throw new Error("No seed selected");
  if (!isSeed(action.item)) throw new Error("Not a seed");

  const seedCount = new Decimal(
    (s.items as Record<string, Decimal>)[action.item] ?? 0,
  );
  if (seedCount.lessThan(1)) throw new Error("Not enough seeds");

  const crop = action.item.split(" ")[0] as CropName;
  const crops = CROPS();
  if (!crops[crop]) throw new Error("Unknown crop");

  const plantedAt = createdAt;
  const nextItems = { ...s.items, [action.item]: seedCount.sub(1) };

  return {
    ...s,
        items: nextItems,
    fields: {
      ...fields,
      [action.index]: { name: crop, plantedAt },
    },
    milestones: trackMilestone(s.milestones, "Seed Planted", 1),
  };
}

// ---------------------------------------------------------------------------
// §2.3-B  Server-side harvest validator
// ---------------------------------------------------------------------------

/**
 * Server-side harvest — validates and applies an `item.harvested` action.
 */
export function serverHarvest(
  state:     GameState,
  action:    { type: "item.harvested"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  if (action.index < 0 || !Number.isInteger(action.index) || action.index >= TOTAL_FIELDS) {
    throw new Error("Field does not exist");
  }

  const field = s.fields[action.index];
  if (!field) throw new Error("Nothing was planted");

  const crops   = CROPS();
  const cropName = field.name as CropName;
  const crop     = crops[cropName];
  if (!crop) throw new Error("Not a crop field");

  // Crop must be watered first; readiness = isWatered && now >= wateredAt + growthMs
  if (!field.isWatered) throw new Error("Crop needs watering first");
  const growthMs = crop.harvestSeconds * 1000;
  if (createdAt < (field.wateredAt ?? 0) + growthMs) throw new Error("Not ready");

  const cropCount    = new Decimal(
    (s.items as Record<string, Decimal>)[field.name] ?? 0,
  );

  const harvestXP    = getHarvestXP(field.name);
  const newFarmingXP = (s.skills.farming ?? 0) + harvestXP;

  let milestones = trackMilestone(s.milestones, "Crop Harvested", 1);
  milestones     = trackMilestone(
    milestones,
    `${field.name} Harvested` as MilestoneName,
    1,
  );

  const newFields = { ...s.fields };
  delete newFields[action.index];

  const nextItems = { ...s.items, [field.name]: cropCount.add(1) };

  return {
    ...s,
    fields:    newFields,
        items: nextItems,
    skills:    { ...s.skills, farming: newFarmingXP },
    milestones,
  };
}

// ---------------------------------------------------------------------------
// §2.3-C  Server-side tree chop validator
// ---------------------------------------------------------------------------

export function serverChop(
  state:     GameState,
  action:    { type: "tree.chopped"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  // Stamina check
  if (!hasEnoughStamina(s.stamina ?? STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA, "chop_tree")) {
    throw new Error("Not enough stamina to chop — eat food to restore stamina");
  }

  // Find Axe in tools[]
  const axeIdx = s.tools.findIndex((t) => t.name === "Axe");
  if (axeIdx === -1) throw new Error("No axe — craft one at the Blacksmith");
  const axe = s.tools[axeIdx];

  const boost      = TOOL_SPEED_BOOST[axe.tier];
  const cooldownMs = CHOP_ACTION_MS * (1 - boost);

  // Auto-initialise: a missing entry means the node has never been chopped —
  // treat it as fresh (choppedAt = 0) rather than throwing.
  const tree: GameNode = s.trees[action.index] ?? { name: "Wood", choppedAt: 0 };
  if (createdAt - (tree.choppedAt ?? 0) <= cooldownMs) {
    throw new Error("Tree is still growing");
  }

  const woodAmt          = new Decimal(
    (s.items as Record<string, Decimal>)["Wood"] ?? 0,
  );
  const newWoodcuttingXP = (s.skills.woodcutting ?? 0) + getSkillXP("chop_tree");

  // Decrement axe durability
  const { decrementDurability } = require("@/features/types/gameplay/tools");
  const decremented = decrementDurability(axe) as typeof axe | null;
  const nextTools   = [...s.tools];
  if (decremented === null) nextTools.splice(axeIdx, 1);
  else nextTools[axeIdx] = decremented;

  const nextItems = { ...s.items, Wood: woodAmt.add(1) };

  return {
    ...s,
        items: nextItems,
    tools:      nextTools,
    stamina:    deductStamina(s.stamina ?? STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA, "chop_tree"),
    trees: {
      ...s.trees,
      [action.index]: {
        name: "Wood" as const,
        choppedAt: createdAt,
      },
    },
    skills:    { ...s.skills, woodcutting: newWoodcuttingXP },
    milestones: trackMilestone(s.milestones, "Tree Chopped", 1),
  };
}

// ---------------------------------------------------------------------------
// §2.3-C  Server-side mining validator (stone-only nodes, pickaxe tier loot)
// ---------------------------------------------------------------------------

export function serverMine(
  state:     GameState,
  action:    { type: "stone.mined"; index: number },
  createdAt: number = Date.now(),
  rng:       () => number = Math.random,
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  // Stamina check
  if (!hasEnoughStamina(s.stamina ?? STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA, "mine_stone")) {
    throw new Error("Not enough stamina to mine — eat food to restore stamina");
  }

  // Find Pickaxe in tools[]
  const pickIdx = s.tools.findIndex((t) => t.name === "Pickaxe");
  if (pickIdx === -1) throw new Error("No pickaxe — craft one at the Blacksmith");
  const pickaxe = s.tools[pickIdx];

  const boost      = TOOL_SPEED_BOOST[pickaxe.tier];
  const cooldownMs = MINE_ACTION_MS * (1 - boost);

  // Auto-initialise: a missing entry means the node has never been mined —
  // treat it as fresh (minedAt = 0) rather than throwing.
  const rock: GameNode = s.stones[action.index] ?? { name: "Stone", minedAt: 0 };
  if (createdAt - (rock.minedAt ?? 0) <= cooldownMs) {
    throw new Error("Rock is still recovering");
  }

  // Luck is a flat % added to each ore's base chance
  const luck      = s.playerStats?.luck ?? 0;
  const lootTable = PICKAXE_LOOT[pickaxe.tier];

  // Roll each ore entry independently
  const oreDrops: OreType[] = [];
  for (const { ore, baseChance } of lootTable) {
    if (rng() * 100 < baseChance + luck) oreDrops.push(ore);
  }

  // Apply Stone + ore drops
  let newItems = { ...s.items };
  const stoneCurrent = new Decimal((newItems as Record<string, Decimal>)["Stone"] ?? 0);
  newItems = { ...newItems, Stone: stoneCurrent.add(1) };
  for (const ore of oreDrops) {
    const current = new Decimal((newItems as Record<string, Decimal>)[ore] ?? 0);
    newItems = { ...newItems, [ore]: current.add(1) };
  }

  const newMiningXP = (s.skills.mining ?? 0) + getSkillXP("mine_stone");

  // Decrement Pickaxe durability
  const decremented = decrementDurability(pickaxe);
  const nextTools   = [...s.tools];
  if (decremented === null) nextTools.splice(pickIdx, 1);
  else nextTools[pickIdx] = decremented;

  let milestones = trackMilestone(s.milestones, "Stone Mined" as MilestoneName, 1);
  if (oreDrops.includes("Iron")) {
    milestones = trackMilestone(milestones, "Iron Mined" as MilestoneName, 1);
  }

  return {
    ...s,
        items: newItems,
    tools:     nextTools,
    stamina:   deductStamina(s.stamina ?? STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA, "mine_stone"),
    stones: {
      ...s.stones,
      [action.index]: { name: "Stone" as const, minedAt: createdAt },
    },
    skills:     { ...s.skills, mining: newMiningXP },
    milestones,
  };
}

// ---------------------------------------------------------------------------
// §2.4-A  Server-side animal feed validators
// ---------------------------------------------------------------------------

export function serverFeedChicken(
  state:     GameState,
  action:    { type: "chicken.feed"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const chickenCount = Number((s.items as Record<string, Decimal>).Chicken ?? 0);
  if (action.index < 0 || action.index >= chickenCount) {
    throw new Error("Chicken does not exist");
  }

  const chicken  = s.chickens[action.index];
  const isRehungry =
    chicken?.fedAt !== undefined &&
    createdAt - chicken.fedAt >= ANIMALS_CONFIG.Chicken.produceTimeMs + ANIMALS_CONFIG.Chicken.reHungerDelayMs;
  if (chicken?.fedAt && !isRehungry) throw new Error("Chicken is not hungry");

  const wheat = new Decimal((s.items as Record<string, Decimal>).Wheat ?? 0);
  if (wheat.lt(1)) throw new Error("Not enough Wheat to feed chicken");
  const chickenFeedItems = { ...s.items, Wheat: wheat.sub(1) };

  return {
    ...s,
        items: chickenFeedItems,
    chickens: {
      ...s.chickens,
      [action.index]: {
        fedAt: createdAt,
      },
    },
    milestones: trackMilestone(s.milestones, "Animal Fed", 1),
  };
}

export function serverFeedCow(
  state:     GameState,
  action:    { type: "cow.feed"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const cow = s.cows[action.index];
  const isRehungry =
    cow?.fedAt !== undefined &&
    createdAt - cow.fedAt >= ANIMALS_CONFIG.Cow.produceTimeMs + ANIMALS_CONFIG.Cow.reHungerDelayMs;
  if (cow?.fedAt && !isRehungry) throw new Error("Cow is not hungry");

  const wheat = new Decimal((s.items as Record<string, Decimal>).Wheat ?? 0);
  if (wheat.lt(1)) throw new Error("Not enough Wheat to feed cow");
  const cowFeedItems = { ...s.items, Wheat: wheat.sub(1) };

  return {
    ...s,
        items: cowFeedItems,
    cows: {
      ...s.cows,
      [action.index]: {
        fedAt: createdAt,
      },
    },
    milestones: trackMilestone(s.milestones, "Animal Fed", 1),
  };
}

export function serverFeedSheep(
  state:     GameState,
  action:    { type: "sheep.feed"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const sheep = s.sheep[action.index];
  const isRehungry =
    sheep?.fedAt !== undefined &&
    createdAt - sheep.fedAt >= ANIMALS_CONFIG.Sheep.produceTimeMs + ANIMALS_CONFIG.Sheep.reHungerDelayMs;
  if (sheep?.fedAt && !isRehungry) throw new Error("Sheep is not hungry");

  const wheat = new Decimal((s.items as Record<string, Decimal>).Wheat ?? 0);
  if (wheat.lt(1)) throw new Error("Not enough Wheat to feed sheep");
  const sheepFeedItems = { ...s.items, Wheat: wheat.sub(1) };

  return {
    ...s,
        items: sheepFeedItems,
    sheep: {
      ...s.sheep,
      [action.index]: {
        fedAt: createdAt,
      },
    },
    milestones: trackMilestone(s.milestones, "Animal Fed", 1),
  };
}

// ---------------------------------------------------------------------------
// §2.4-B  Server-side animal produce validators
// ---------------------------------------------------------------------------

export function serverCollectEgg(
  state:     GameState,
  action:    { type: "chicken.collectEgg"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const chickenCount = Number((s.items as Record<string, Decimal>).Chicken ?? 0);
  if (action.index < 0 || action.index >= chickenCount) {
    throw new Error("Chicken does not exist");
  }

  const chicken = s.chickens[action.index];
  if (!chicken?.fedAt) throw new Error("Chicken has not been fed");
  if (createdAt - chicken.fedAt < ANIMALS_CONFIG.Chicken.produceTimeMs) throw new Error("Egg is not ready yet");

  const currentEggs = new Decimal((s.items as Record<string, Decimal>).Egg ?? 0);
  const newHusbXP   = (s.skills.husbandry ?? 0) + getSkillXP("collect_egg");
  const newSkills   = { ...s.skills, husbandry: newHusbXP };
  const eggItems    = { ...s.items, Egg: currentEggs.add(1) };

  return {
    ...s,
        items: eggItems,
    chickens:   { ...s.chickens, [action.index]: { fedAt: undefined } },
    skills:     newSkills,
    milestones: trackMilestone(s.milestones, "Egg Collected", 1),
  };
}

export function serverCollectMilk(
  state:     GameState,
  action:    { type: "cow.collectMilk"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const cowCount = Number((s.items as Record<string, Decimal>).Cow ?? 0);
  if (action.index < 0 || action.index >= cowCount) throw new Error("Cow does not exist");

  const cow = s.cows[action.index];
  if (!cow?.fedAt) throw new Error("Cow has not been fed");
  if (createdAt - cow.fedAt < ANIMALS_CONFIG.Cow.produceTimeMs) throw new Error("Milk is not ready yet");

  const currentMilk = new Decimal((s.items as Record<string, Decimal>).Milk ?? 0);
  const newHusbXP   = (s.skills.husbandry ?? 0) + getSkillXP("collect_milk");
  const newSkills   = { ...s.skills, husbandry: newHusbXP };
  const milkItems   = { ...s.items, Milk: currentMilk.add(1) };

  return {
    ...s,
        items: milkItems,
    cows:       { ...s.cows, [action.index]: { fedAt: undefined } },
    skills:     newSkills,
    milestones: trackMilestone(s.milestones, "Milk Collected", 1),
  };
}

export function serverCollectWool(
  state:     GameState,
  action:    { type: "sheep.collectWool"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const sheepCount = Number((s.items as Record<string, Decimal>).Sheep ?? 0);
  if (action.index < 0 || action.index >= sheepCount) throw new Error("Sheep does not exist");

  const sheep = s.sheep[action.index];
  if (!sheep?.fedAt) throw new Error("Sheep has not been fed");
  if (createdAt - sheep.fedAt < ANIMALS_CONFIG.Sheep.produceTimeMs) throw new Error("Wool is not ready yet");

  const currentWool = new Decimal((s.items as Record<string, Decimal>).Wool ?? 0);
  const newHusbXP   = (s.skills.husbandry ?? 0) + getSkillXP("collect_wool");
  const newSkills   = { ...s.skills, husbandry: newHusbXP };
  const woolItems   = { ...s.items, Wool: currentWool.add(1) };

  return {
    ...s,
        items: woolItems,
    sheep:      { ...s.sheep, [action.index]: { fedAt: undefined } },
    skills:     newSkills,
    milestones: trackMilestone(s.milestones, "Wool Collected", 1),
  };
}

// ---------------------------------------------------------------------------
// §2.3-F  Server-side water field validator
// ---------------------------------------------------------------------------

export function serverWaterField(
  state:     GameState,
  action:    { type: "field.watered"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  if (action.index < 0 || !Number.isInteger(action.index) || action.index >= TOTAL_FIELDS) {
    throw new Error("Field does not exist");
  }

  // Watering Can required
  const canIdx = s.tools.findIndex((t) => t.name === "Watering Can");
  if (canIdx === -1) throw new Error("No Watering Can — craft one at the Blacksmith");
  const can = s.tools[canIdx];

  const field = s.fields[action.index];
  if (!field)          throw new Error("Nothing planted in that field");
  if (!field.plantedAt) throw new Error("Field is not planted");
  if (field.isWatered) throw new Error("Field has already been watered");

  const crops    = CROPS();
  const cropName = field.name as import("@/features/types/gameplay/crops").CropName;
  const crop     = crops[cropName];
  if (!crop) throw new Error("Unknown crop");

  // Decrement Watering Can durability
  const { decrementDurability: decDur } = require("@/features/types/gameplay/tools");
  const decremented = decDur(can) as typeof can | null;
  const nextTools   = [...s.tools];
  if (decremented === null) nextTools.splice(canIdx, 1);
  else nextTools[canIdx] = decremented;

  const newFarmingXP = (s.skills.farming ?? 0) + getSkillXP("water_field");

  return {
    ...s,
    tools: nextTools,
    fields: {
      ...s.fields,
      [action.index]: {
        ...field,
        wateredAt: createdAt,
        isWatered: true,
      },
    },
    skills: { ...s.skills, farming: newFarmingXP },
  };
}

// ---------------------------------------------------------------------------
// §2.4-C  Server-side fishing validator
// ---------------------------------------------------------------------------

export function serverCatchFish(
  state:           GameState,
  action:          { type: "fish.caught"; createdAt: number },
  _createdAt:      number = Date.now(),
  /** lastCastAt from player.activity — checked here instead of farm.fishing */
  playerLastCast:  number = 0,
): GameState {
  const createdAt = action.createdAt;
  const s         = applyStaminaRegen(state, createdAt);

  // Rod required (ownership check — equip is enforced client-side)
  const rodIdx = s.tools.findIndex((t) => t.name === "Rod");
  if (rodIdx === -1) throw new Error("No Rod — craft one at the Blacksmith");

  // Cooldown lives on player.activity.lastCastAt, not the farm document.
  if (createdAt - playerLastCast < FISHING_ACTION_MS) {
    throw new Error("Fishing is on cooldown");
  }

  const fishingXP    = s.skills.fishing ?? 0;
  const fishingLevel = getSkillLevel(fishingXP);

  const minRequired = Math.min(...FISH_TABLE.map((f) => f.minLevel));
  if (fishingLevel < minRequired) {
    throw new Error(`Requires Fishing Level ${minRequired} to fish`);
  }

  const caught = rollCatch(fishingLevel);

  const catchXP      = getFishXP(caught);
  const newFishingXP = fishingXP + catchXP;
  const current   = new Decimal((s.items as Record<string, Decimal>)[caught] ?? 0);
  const fishItems = { ...s.items, [caught]: current.add(1) };

  return {
    ...s,
        items: fishItems,
    skills:    { ...s.skills, fishing: newFishingXP },
    fishing: {
      lastCastAt:     createdAt,
      lastCaughtFish: caught,
    },
    milestones: trackMilestone(
      trackMilestone(s.milestones, "Fish Caught", 1),
      `${caught} Caught` as MilestoneName,
      1,
    ),
  };
}

// ---------------------------------------------------------------------------
// §2.4-D (instant) — Cook food
// ---------------------------------------------------------------------------

export function serverCookFood(
  state: GameState,
  action: CookFoodAction,
  _createdAt: number,
): GameState {
  const s = applyStaminaRegen(state, _createdAt);
  const { food, amount = 1 } = action;
  const recipe = FOODS()[food as Food];

  if (!recipe) throw new Error(`Unknown food: ${food}`);
  if (amount < 1 || !Number.isInteger(amount)) throw new Error("Amount must be a positive integer.");

  // Gate on farmLevel (replaces unlockedRecipes check).
  const farmLevel     = s.farmLevel ?? 1;
  const requiredLevel = FOOD_FARM_LEVEL_REQUIREMENT[food as Food] ?? 1;
  if (farmLevel < requiredLevel) {
    throw new Error(`Recipe "${food}" requires Farm Level ${requiredLevel}.`);
  }

  let items = { ...s.items };

  // Deduct food-specific ingredients
  for (const { item, amount: needed } of recipe.ingredients) {
    const have = items[item as keyof typeof items] ?? new Decimal(0);
    const total = needed.mul(amount);
    if ((have as Decimal).lessThan(total)) {
      throw new Error(`Not enough ${item}. Need ${total}, have ${have}.`);
    }
    items = { ...items, [item]: (have as Decimal).minus(total) };
  }

  // Deduct 1x Wood per portion as fuel
  const woodHave = new Decimal((items as Record<string, Decimal>)["Wood"] ?? 0);
  const woodCost = new Decimal(amount);
  if (woodHave.lessThan(woodCost)) {
    throw new Error(`Not enough Wood fuel. Need ${woodCost}, have ${woodHave}.`);
  }
  items = { ...items, Wood: woodHave.minus(woodCost) };

  const currentFood = new Decimal((items as Record<string, Decimal>)[food] ?? 0);
  items = { ...items, [food]: currentFood.plus(amount) };

  let milestones = trackMilestone(s.milestones, "Food Cooked", amount);
  milestones = trackMilestone(milestones, `${food} Cooked` as MilestoneName, amount);

  const cookingXP = (s.skills.cooking ?? 0) + getCookXP(food) * amount;

  return {
    ...s,
    items,
    skills: { ...s.skills, cooking: cookingXP },
    milestones,
  };
}

// ---------------------------------------------------------------------------
// §2.5-A  Server-side coal craft validator
// ---------------------------------------------------------------------------

  /** 30s smithing action duration (shared by coal, smelt, and equipment forge). */
  export const SMITH_ACTION_MS = 30_000;

  /** 10s cooking action duration. */
  export const COOK_ACTION_MS = 10_000;

  export function serverCraftCoal(
  state:     GameState,
  action:    { type: "coal.crafted"; amount: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);
  if (action.amount < 1 || !Number.isInteger(action.amount)) {
    throw new Error("Amount must be a positive integer");
  }

  const woodNeeded = action.amount * COAL_WOOD_COST;
  const woodHave   = new Decimal((s.items as Record<string, Decimal>)["Wood"] ?? 0);
  if (woodHave.lt(woodNeeded)) {
    throw new Error(`Not enough Wood — need ${woodNeeded}, have ${woodHave}`);
  }

  const coalHave   = new Decimal((s.items as Record<string, Decimal>)["Coal"] ?? 0);
  const smithXP    = (s.skills.smithing ?? 0) + getSkillXP("smith_action");
  const coalItems  = { ...s.items, Wood: woodHave.sub(woodNeeded), Coal: coalHave.add(action.amount) };

  return {
    ...s,
        items: coalItems,
    skills: { ...s.skills, smithing: smithXP },
  };
}

// ---------------------------------------------------------------------------
// §2.5-B  Server-side ore smelt validator
// ---------------------------------------------------------------------------

/** Map from OreType to its Ingot ResourceName. */
const SERVER_ORE_TO_INGOT: Record<OreType, string> = {
  Iron:     "Iron Ingot",
  Silver:   "Silver Ingot",
  Emerald:  "Emerald Ingot",
  Diamond:  "Diamond Ingot",
  Ignisite: "Ignisite Ingot",
};

export function serverSmeltOre(
  state:     GameState,
  action:    { type: "ore.smelted"; ore: OreType; amount: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);
  if (action.amount < 1 || !Number.isInteger(action.amount)) {
    throw new Error("Amount must be a positive integer");
  }

  const oreNeeded  = action.amount * SMELT_ORE_PER_INGOT;
  const coalNeeded = action.amount * SMELT_COAL_PER_INGOT;
  const ingotName  = SERVER_ORE_TO_INGOT[action.ore];
  if (!ingotName) throw new Error(`Unknown ore type: ${action.ore}`);

  const oreHave  = new Decimal((s.items as Record<string, Decimal>)[action.ore]  ?? 0);
  const coalHave = new Decimal((s.items as Record<string, Decimal>)["Coal"]      ?? 0);

  if (oreHave.lt(oreNeeded))   throw new Error(`Not enough ${action.ore} — need ${oreNeeded}, have ${oreHave}`);
  if (coalHave.lt(coalNeeded)) throw new Error(`Not enough Coal — need ${coalNeeded}, have ${coalHave}`);

  const ingotHave  = new Decimal((s.items as Record<string, Decimal>)[ingotName] ?? 0);
  const smithXP    = (s.skills.smithing ?? 0) + getSkillXP("smith_action");
  const smeltItems = {
    ...s.items,
    [action.ore]: oreHave.sub(oreNeeded),
    Coal:         coalHave.sub(coalNeeded),
    [ingotName]:  ingotHave.add(action.amount),
  };

  return {
    ...s,
        items: smeltItems,
    skills: { ...s.skills, smithing: smithXP },
  };
}

// ---------------------------------------------------------------------------
// §2.5-C  Server-side craft tool validator
// ---------------------------------------------------------------------------

export function serverCraftTool(
  state:     GameState,
  action:    { type: "tool.crafted"; tool: string; tier?: ToolTier },
  createdAt: number = Date.now(),
): GameState {
  const s   = applyStaminaRegen(state, createdAt);
  const cfg = TOOLS()[action.tool as ToolName];
  if (!cfg) throw new Error(`Unknown tool: ${action.tool}`);

  const tier: ToolTier = action.tier ?? "Wood";

  // Wood tools: free, capped at 1 per tool name
  if (tier === "Wood") {
    const alreadyOwns = s.tools.some((t) => t.name === action.tool && t.tier === "Wood");
    if (alreadyOwns) throw new Error(`You already own a Wood ${action.tool}`);
    return {
      ...s,
      tools: [...s.tools, createToolInstance(action.tool as ToolName, "Wood")],
    };
  }

  // Ore-tier tools: deduct 3x matching ingot
  const recipe = TOOL_CRAFT_RECIPES[tier];
  let items    = { ...s.items };
  for (const [ingredient, rawQty] of Object.entries(recipe)) {
    const qty  = rawQty ?? 0; // TOOL_CRAFT_RECIPES values are Partial → may be undefined
    const have = new Decimal((items as Record<string, Decimal>)[ingredient] ?? 0);
    if (have.lt(qty)) throw new Error(`Not enough ${ingredient} (need ${qty})`);
    items = { ...items, [ingredient]: have.sub(qty) };
  }
  const smithXP = (s.skills.smithing ?? 0) + getSkillXP("smith_action");

  return {
    ...s,
        items: items,
    tools:    [...s.tools, createToolInstance(action.tool as ToolName, tier)],
    skills:   { ...s.skills, smithing: smithXP },
  };
}

// ---------------------------------------------------------------------------
// Farm Upgrade — server-side validator
// ---------------------------------------------------------------------------

/**
 * Server-side farm upgrade — validates and applies a "farm.upgrade" action.
 * Deducts lfrgCost from state.coins and increments farmLevel.
 * lfrgCost is computed from the live LFRG/USD pair price at request time.
 */
export function serverFarmUpgrade(state: GameState, lfrgCost: number): GameState {
  const current = state.farmLevel ?? 1;

  if (current >= MAX_FARM_LEVEL) {
    throw new Error("Farm is already at max level");
  }

  const target = current + 1;
  const cost   = FARM_LEVEL_UPGRADES[target];
  if (!cost) throw new Error(`No upgrade cost defined for Farm Level ${target}`);

  const xpTotal = totalSkillXp(state.skills);
  if (xpTotal < cost.xpRequired) {
    throw new Error(
      `Need ${cost.xpRequired.toLocaleString()} total skill XP to reach Farm Level ${target} (you have ${xpTotal.toLocaleString()})`,
    );
  }

  const currentCoins = new Decimal(state.coins ?? 0);
  const costDecimal  = new Decimal(lfrgCost);
  if (currentCoins.lt(costDecimal)) {
    throw new Error(`Not enough $LFRG tokens (need ${lfrgCost}, have ${currentCoins.toNumber()})`);
  }

  return {
    ...state,
    farmLevel: target,
    coins:     currentCoins.sub(costDecimal),
  };
}

// (duplicate serverWaterField removed — canonical definition is §2.3-F above)

// ---------------------------------------------------------------------------
// §2.6-B  Server-side destroy armor validator
// ---------------------------------------------------------------------------

export function serverDestroyArmor(
  state:     GameState,
  action:    { type: "armor.destroyed"; id: string },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const armorIdx = s.equipment.owned.findIndex((item: EquipmentItem) => item.id === action.id);
  if (armorIdx === -1) throw new Error("Armor not found in inventory");

  const armor = s.equipment.owned[armorIdx];
  if (armor.tier === "Wood") throw new Error("Wood armor cannot be destroyed");

  // Unequip first if currently equipped
  const equippedValues = Object.values(s.equipment.equipped) as (EquipmentItem | null)[];
  const isEquipped = equippedValues.some((e) => e?.id === action.id);
  if (isEquipped) throw new Error("Unequip this armor before destroying it");

  const shardPayout = getDestroyShardPayout(armor);
  const currentShards = new Decimal((s.items as Record<string, Decimal>)["Shard"] ?? 0);
  const nextItems = { ...s.items, Shard: currentShards.add(shardPayout) };

  const nextOwned = [...s.equipment.owned];
  nextOwned.splice(armorIdx, 1);

  const smithXP = (s.skills.smithing ?? 0) + getSkillXP("smith_action");

  return {
    ...s,
        items: nextItems,
    equipment: { ...s.equipment, owned: nextOwned },
    skills:    { ...s.skills, smithing: smithXP },
  };
}

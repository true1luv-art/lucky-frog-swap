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
import type { GameState, GameNode } from "@/shared/types/gameplay/game";
import { CROPS }                    from "@/shared/types/gameplay/crops";
import type { CropName }            from "@/shared/types/gameplay/crops";
import { INITIAL_BONUS }            from "@/shared/types/gameplay/skills";
import {
  getSkillXP,
  getHarvestXP,
  getSkillLevel,
  getCookXP,
} from "@/shared/game/skills";
import {
  getCropYield,
  rollCropDouble,
  getWoodYield,
  rollWoodDouble,
  getOreYield,
  rollOreDouble,
  getReducedDuration,
  getRoundedReducedDuration,
  getSnapshotTimestamp,
} from "@/shared/game/boosts";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";
import {
  hasEnoughStamina,
  deductStamina,
  STAMINA_CONSTANTS,
} from "@/shared/game/stamina";
import { trackActivity } from "@/shared/game/activity";
import type { ActivityName } from "@/shared/types/gameplay/achievements";
import {
  isFieldUnlocked,
  getFieldLevelRequirement,
  TOTAL_FIELDS,
} from "@/shared/game/experience";
import {
  TREE_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
  IRON_RECOVERY_SECONDS,
  GOLD_RECOVERY_SECONDS,
  CROPS_CONFIG,
  ANIMALS_CONFIG,
  FISH_TABLE,
} from "@/shared/data/farming";
import {
  CHICKEN_TIME_TO_EGG,
  CHICKEN_RE_HUNGER_DELAY,
  COW_TIME_TO_MILK,
  COW_RE_HUNGER_DELAY,
  SHEEP_TIME_TO_WOOL,
  SHEEP_RE_HUNGER_DELAY,
  FISHING_BASE_COOLDOWN_MS,
  FISHING_MIN_COOLDOWN_MS,
} from "@/shared/game/constants";
import { rollCatch }                                from "@/shared/game/fishing";
import { FOODS }                                   from "@/shared/types/gameplay/craftables";
import type { Food }                               from "@/shared/types/gameplay/craftables";

// ---------------------------------------------------------------------------
// §2.3-D  Stamina regen pre-step
// ---------------------------------------------------------------------------

/**
 * Applies any pending stamina regeneration ticks to the state, using
 * `createdAt` as the "now" reference instead of `Date.now()`.
 *
 * This is the server-side equivalent of the Phaser `stamina.regenerate` event.
 * It is called at the top of every server-side action validator so the
 * server always works with current stamina before checking sufficiency.
 */
export function applyStaminaRegen(
  state:     GameState,
  createdAt: number,
): GameState {
  const maxStamina  = STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;
  const lastRegen   = state.lastStaminaRegenAt;
  const elapsed     = createdAt - lastRegen;
  const intervals   = Math.floor(elapsed / STAMINA_CONSTANTS.REGEN_INTERVAL_MS);

  if (intervals <= 0) return state;

  const capped     = Math.min(intervals, STAMINA_CONSTANTS.MAX_OFFLINE_REGEN_INTERVALS);
  const regenAmt   = Math.ceil(maxStamina * STAMINA_CONSTANTS.STAMINA_REGEN_PERCENT * capped);
  const newStamina = Math.min(state.stamina.current + regenAmt, maxStamina);
  const newRegenAt = lastRegen + capped * STAMINA_CONSTANTS.REGEN_INTERVAL_MS;

  return {
    ...state,
    stamina:            { current: newStamina, max: maxStamina },
    lastStaminaRegenAt: newRegenAt,
  };
}

// ---------------------------------------------------------------------------
// §2.3-A  Server-side plant validator
// ---------------------------------------------------------------------------

const VALID_SEED_SUFFIXES = [
  "Potato Seed", "Carrot Seed", "Cabbage Seed", "Pumpkin Seed",
  "Beetroot Seed", "Parsnip Seed", "Radish Seed", "Cauliflower Seed",
  "Wheat Seed", "Kale Seed",
] as const;

function isSeed(item: string): boolean {
  return (VALID_SEED_SUFFIXES as readonly string[]).includes(item);
}

/**
 * Server-side plant — validates and applies an `item.planted` action.
 *
 * Checks performed (§2.3-A, §2.3-E):
 * - Field index in range [0, TOTAL_FIELDS).
 * - Field unlocked given server-computed farming level (not client-claimed).
 * - Field not already occupied.
 * - A valid seed item was specified.
 * - Seed quantity >= 1 in server inventory.
 *
 * Note: plant does NOT cost stamina (STAMINA_COSTS.plant = 0).
 */
export function serverPlant(
  state:     GameState,
  action:    { type: "item.planted"; item?: string; index: number },
  createdAt: number = Date.now(),
): GameState {
  // Stamina pre-step (regen only; plant costs 0)
  const s = applyStaminaRegen(state, createdAt);
  const fields = { ...s.fields };

  // §2.3-E field index + unlock gate
  if (action.index < 0 || !Number.isInteger(action.index) || action.index >= TOTAL_FIELDS) {
    throw new Error("Field does not exist");
  }
  const farmingLevel = getSkillLevel(s.skills.farming);
  if (!isFieldUnlocked(action.index, farmingLevel)) {
    throw new Error(
      `Field requires Farming Level ${getFieldLevelRequirement(action.index)}`,
    );
  }
  if (fields[action.index]) throw new Error("Crop is already planted");
  if (!action.item)         throw new Error("No seed selected");
  if (!isSeed(action.item)) throw new Error("Not a seed");

  // §2.3-A validate server inventory (not client-claimed)
  const seedCount = new Decimal(
    (s.inventory as Record<string, Decimal>)[action.item] ?? 0,
  );
  if (seedCount.lessThan(1)) throw new Error("Not enough seeds");

  // Derive crop name from seed ("Potato Seed" → "Potato")
  const crop = action.item.split(" ")[0] as CropName;
  const crops = CROPS();
  if (!crops[crop]) throw new Error("Unknown crop");

  const seedLevelRequirement = CROPS_CONFIG[crop].farmingLevelRequired;
  if (farmingLevel < seedLevelRequirement) {
    throw new Error(`Seed requires Farming Level ${seedLevelRequirement}`);
  }

  // Speed bonus offset (same as Phaser getPlantedAt)
  const cropBase = crops[crop].harvestSeconds;
  const plantedAt = getSnapshotTimestamp(
    createdAt,
    cropBase * 1000,
    s.bonus?.cropSpeed ?? 0,
  );

  return {
    ...s,
    inventory: {
      ...s.inventory,
      [action.item]: seedCount.sub(1),
    },
    fields: {
      ...fields,
      [action.index]: { name: crop, plantedAt, amount: 1 },
    },
  };
}

// ---------------------------------------------------------------------------
// §2.3-B  Server-side harvest validator
// ---------------------------------------------------------------------------

/**
 * Server-side harvest — validates and applies an `item.harvested` action.
 *
 * Checks performed (§2.3-B, §2.3-D):
 * - Sufficient stamina (cost = 1 "harvest_crop").
 * - Field index in range and occupied.
 * - Crop maturity: `createdAt - field.plantedAt >= crop.harvestSeconds * 1000`.
 *   Uses server `plantedAt` from the farm document — client cannot fake it.
 * - Yield and XP computed from server-side skill bonus.
 */
export function serverHarvest(
  state:     GameState,
  action:    { type: "item.harvested"; index: number },
  createdAt: number = Date.now(),
): GameState {
  // §2.3-D: regen before checking stamina
  const s = applyStaminaRegen(state, createdAt);

  if (!hasEnoughStamina(s.stamina.current, "harvest_crop")) {
    throw new Error("Not enough stamina to harvest");
  }

  if (action.index < 0 || !Number.isInteger(action.index) || action.index >= TOTAL_FIELDS) {
    throw new Error("Field does not exist");
  }

  const field = s.fields[action.index];
  if (!field) throw new Error("Nothing was planted");

  const crops   = CROPS();
  const cropName = field.name as CropName;
  const crop     = crops[cropName];
  if (!crop) throw new Error("Not a crop field");

  // §2.3-B: maturity check against server plantedAt
  if (createdAt - (field.plantedAt ?? 0) < crop.harvestSeconds * 1000) {
    throw new Error("Not ready");
  }

  // Yield
  const bonus      = s.bonus ?? { ...INITIAL_BONUS };
  const boosted    = getCropYield(field.amount ?? 1, bonus);
  const yieldAmt   = rollCropDouble(bonus) ? boosted * 2 : boosted;

  // Inventory update
  const cropCount  = new Decimal(
    (s.inventory as Record<string, Decimal>)[field.name] ?? 0,
  );

  // XP
  const harvestXP    = getHarvestXP(field.name);
  const newFarmingXP = (s.skills.farming ?? 0) + harvestXP;

  // Level-up bonus recompute
  const oldLevel = getSkillLevel(s.skills.farming ?? 0);
  const newLevel = getSkillLevel(newFarmingXP);
  const newBonus =
    newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(
        { ...s.skills, farming: newFarmingXP },
        s.ownedCollectibles,
      )
    : bonus;


  // Activity
  let activity = trackActivity(s.activity, "Crop Harvested", 1);
  activity      = trackActivity(
    activity,
    `${field.name} Harvested` as ActivityName,
    1,
  );

  const newFields = { ...s.fields };
  delete newFields[action.index];

  return {
    ...s,
    fields:    newFields,
    inventory: { ...s.inventory, [field.name]: cropCount.add(yieldAmt) },
    skills:    { ...s.skills, farming: newFarmingXP },
    bonus:     newBonus,
    stamina:   { ...s.stamina, current: deductStamina(s.stamina.current, "harvest_crop") },
    activity,
  };
}

// ---------------------------------------------------------------------------
// §2.3-C  Server-side tree chop validator
// ---------------------------------------------------------------------------

/**
 * Server-side chop — validates and applies a `tree.chopped` action.
 *
 * Checks (§2.3-C, §2.3-D):
 * - Sufficient stamina (cost = 1 "chop_tree").
 * - Tree node exists at index.
 * - Recovery time elapsed: `createdAt - tree.choppedAt > TREE_RECOVERY_SECONDS * 1000`.
 */
export function serverChop(
  state:     GameState,
  action:    { type: "tree.chopped"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  if (!hasEnoughStamina(s.stamina.current, "chop_tree")) {
    throw new Error("Not enough stamina to chop");
  }

  const tree = s.trees[action.index];
  if (!tree) throw new Error("No tree");
  if (createdAt - (tree.choppedAt ?? 0) <= TREE_RECOVERY_SECONDS * 1000) {
    throw new Error("Tree is still growing");
  }

  const bonus    = s.bonus ?? { ...INITIAL_BONUS };
  const boosted  = getWoodYield(tree.amount ?? 3, bonus);
  const woodDrop = rollWoodDouble(bonus) ? boosted * 2 : boosted;

  const woodAmt       = new Decimal(
    (s.inventory as Record<string, Decimal>)["Wood"] ?? 0,
  );
  const newWoodcuttingXP = (s.skills.woodcutting ?? 0) + getSkillXP("chop_tree");
  // TODO: tree leveling
  const oldLevel = getSkillLevel(s.skills.woodcutting ?? 0);
  const newLevel = getSkillLevel(newWoodcuttingXP);
  const newBonus = newLevel > oldLevel
    ? recomputeOwnedBonuses(
        { ...s.skills, woodcutting: newWoodcuttingXP },
        s.ownedCollectibles,
      )
    : s.bonus;
  return {
    ...s,
    inventory: { ...s.inventory, Wood: woodAmt.add(woodDrop) },
    trees: {
      ...s.trees,
      [action.index]: {
        name: "Wood" as const,
        choppedAt: getSnapshotTimestamp(
          createdAt,
          TREE_RECOVERY_SECONDS * 1000,
          bonus.woodRecovery,
        ),
        amount: 3,
      },
    },
    skills:    { ...s.skills, woodcutting: newWoodcuttingXP },
    bonus:     newBonus,
    stamina:   { ...s.stamina, current: deductStamina(s.stamina.current, "chop_tree") },
    activity:  trackActivity(s.activity, "Tree Chopped", 1),
  };
}

// ---------------------------------------------------------------------------
// §2.3-C  Server-side ore mining validators
// ---------------------------------------------------------------------------

/** Shared ore-mine logic — avoids repeating for stone/iron/gold. */
function serverMineOre(
  state:      GameState,
  action:     { index: number },
  createdAt:  number,
  collection: "stones" | "iron" | "gold",
  itemName:   "Stone" | "Iron" | "Gold",
  staminaKey: "mine_stone" | "mine_iron" | "mine_gold",
  xpKey:      "mine_stone" | "mine_iron" | "mine_gold",
  recoverySec: number,
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  if (!hasEnoughStamina(s.stamina.current, staminaKey)) {
    throw new Error(`Not enough stamina to mine`);
  }

  const nodes = s[collection] as Record<number, GameNode>;
  const rock  = nodes[action.index];
  if (!rock) throw new Error("No rock");
  if (createdAt - (rock.minedAt ?? 0) <= recoverySec * 1000) {
    throw new Error("Rock is still recovering");
  }

  const bonus   = s.bonus ?? { ...INITIAL_BONUS };
  const boosted = getOreYield(rock.amount ?? 2, bonus);
  const oreDrop = rollOreDouble(bonus) ? boosted * 2 : boosted;

  const oreCurrent  = new Decimal(
    (s.inventory as Record<string, Decimal>)[itemName] ?? 0,
  );
  const newMiningXP = (s.skills.mining ?? 0) + getSkillXP(xpKey);

  const oldLevel = getSkillLevel(s.skills.mining ?? 0);
  const newLevel = getSkillLevel(newMiningXP);
  const newBonus =
    newLevel > oldLevel && newLevel % 10 === 0
      ? recomputeOwnedBonuses(
          { ...s.skills, mining: newMiningXP },
          s.ownedCollectibles,
        )
      : bonus;

  const activityLabel =
    itemName === "Stone"
      ? ("Stone Mined" as ActivityName)
      : itemName === "Iron"
        ? ("Iron Mined" as ActivityName)
        : ("Gold Mined" as ActivityName);

  return {
    ...s,
    inventory: { ...s.inventory, [itemName]: oreCurrent.add(oreDrop) },
    [collection]: {
      ...nodes,
      [action.index]: {
        name: itemName,
        minedAt: getSnapshotTimestamp(
          createdAt,
          recoverySec * 1000,
          bonus.oreRecovery,
        ),
        amount: 2,
      },
    },
    skills:   { ...s.skills, mining: newMiningXP },
    bonus:    newBonus,
    stamina:  { ...s.stamina, current: deductStamina(s.stamina.current, staminaKey) },
    activity: trackActivity(s.activity, activityLabel, 1),
  };
}

export function serverMineStone(
  state:     GameState,
  action:    { type: "stone.mined"; index: number },
  createdAt: number = Date.now(),
): GameState {
  return serverMineOre(
    state, action, createdAt,
    "stones", "Stone", "mine_stone", "mine_stone",
    STONE_RECOVERY_SECONDS,
  );
}

export function serverMineIron(
  state:     GameState,
  action:    { type: "iron.mined"; index: number },
  createdAt: number = Date.now(),
): GameState {
  return serverMineOre(
    state, action, createdAt,
    "iron", "Iron", "mine_iron", "mine_iron",
    IRON_RECOVERY_SECONDS,
  );
}

export function serverMineGold(
  state:     GameState,
  action:    { type: "gold.mined"; index: number },
  createdAt: number = Date.now(),
): GameState {
  return serverMineOre(
    state, action, createdAt,
    "gold", "Gold", "mine_gold", "mine_gold",
    GOLD_RECOVERY_SECONDS,
  );
}

// ---------------------------------------------------------------------------
// §2.4-A  Server-side animal feed validators
// ---------------------------------------------------------------------------

// Animal timing + fishing constants are imported at the top of this file.

/**
 * serverFeedChicken — §2.4-A
 * Mirrors feedChicken.ts but validates server inventory and timestamps.
 * - Chicken slot exists (owner has Chicken in server inventory).
 * - Chicken is either unfed or re-hungry (fedAt + EGG_TIME + RE_HUNGER elapsed).
 * - Player owns ≥1 Wheat in server inventory.
 */
export function serverFeedChicken(
  state:     GameState,
  action:    { type: "chicken.feed"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  // §2.5-D — enforce farming level gate from server skill, not client-claimed level
  const farmingLevel = getSkillLevel(s.skills.farming);
  const chickenReq   = ANIMALS_CONFIG.Chicken.farmingLevelRequired;
  if (farmingLevel < chickenReq) {
    throw new Error(`Requires Farming Level ${chickenReq} to use Chickens`);
  }

  const chickenCount = Number(s.inventory.Chicken ?? 0);
  if (action.index < 0 || action.index >= chickenCount) {
    throw new Error("Chicken does not exist");
  }

  const chicken  = s.chickens[action.index];
  const isRehungry =
    chicken?.fedAt !== undefined &&
    createdAt - chicken.fedAt >= CHICKEN_TIME_TO_EGG + CHICKEN_RE_HUNGER_DELAY;
  if (chicken?.fedAt && !isRehungry) throw new Error("Chicken is not hungry");

  const wheat = new Decimal((s.inventory as Record<string, Decimal>).Wheat ?? 0);
  if (wheat.lt(1)) throw new Error("Not enough Wheat to feed chicken");

  return {
    ...s,
    inventory: { ...s.inventory, Wheat: wheat.sub(1) },
    chickens: {
      ...s.chickens,
      [action.index]: {
        fedAt: getSnapshotTimestamp(createdAt, CHICKEN_TIME_TO_EGG, s.bonus.produceSpeed),
        multiplier: 1,
      },
    },
    activity:  trackActivity(s.activity, "Animal Fed", 1),
  };
}

/**
 * serverFeedCow — §2.4-A
 * Mirrors feedCow.ts. Eats Kale.
 */
export function serverFeedCow(
  state:     GameState,
  action:    { type: "cow.feed"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  // §2.5-D — farming level gate
  const farmingLevel = getSkillLevel(s.skills.farming);
  const cowReq       = ANIMALS_CONFIG.Cow.farmingLevelRequired;
  if (farmingLevel < cowReq) {
    throw new Error(`Requires Farming Level ${cowReq} to use Cows`);
  }

  const cow = s.cows[action.index];
  const isRehungry =
    cow?.fedAt !== undefined &&
    createdAt - cow.fedAt >= COW_TIME_TO_MILK + COW_RE_HUNGER_DELAY;
  if (cow?.fedAt && !isRehungry) throw new Error("Cow is not hungry");

  const kale = new Decimal((s.inventory as Record<string, Decimal>).Kale ?? 0);
  if (kale.lt(1)) throw new Error("Not enough Kale to feed cow");

  return {
    ...s,
    inventory: { ...s.inventory, Kale: kale.sub(1) },
    cows: {
      ...s.cows,
      [action.index]: {
        fedAt: getSnapshotTimestamp(createdAt, COW_TIME_TO_MILK, s.bonus.produceSpeed),
        multiplier: 1,
      },
    },
    activity:  trackActivity(s.activity, "Animal Fed", 1),
  };
}

/**
 * serverFeedSheep — §2.4-A
 * Mirrors feedSheep.ts. Eats Cabbage.
 */
export function serverFeedSheep(
  state:     GameState,
  action:    { type: "sheep.feed"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  // §2.5-D — farming level gate
  const farmingLevel = getSkillLevel(s.skills.farming);
  const sheepReq     = ANIMALS_CONFIG.Sheep.farmingLevelRequired;
  if (farmingLevel < sheepReq) {
    throw new Error(`Requires Farming Level ${sheepReq} to use Sheep`);
  }

  const sheep = s.sheep[action.index];
  const isRehungry =
    sheep?.fedAt !== undefined &&
    createdAt - sheep.fedAt >= SHEEP_TIME_TO_WOOL + SHEEP_RE_HUNGER_DELAY;
  if (sheep?.fedAt && !isRehungry) throw new Error("Sheep is not hungry");

  const cabbage = new Decimal((s.inventory as Record<string, Decimal>).Cabbage ?? 0);
  if (cabbage.lt(1)) throw new Error("Not enough Cabbage to feed sheep");

  return {
    ...s,
    inventory: { ...s.inventory, Cabbage: cabbage.sub(1) },
    sheep: {
      ...s.sheep,
      [action.index]: {
        fedAt: getSnapshotTimestamp(createdAt, SHEEP_TIME_TO_WOOL, s.bonus.produceSpeed),
        multiplier: 1,
      },
    },
    activity:  trackActivity(s.activity, "Animal Fed", 1),
  };
}

// ---------------------------------------------------------------------------
// §2.4-B  Server-side animal produce validators
// ---------------------------------------------------------------------------

/**
 * serverCollectEgg — §2.4-B
 * Mirrors collectEgg.ts. Uses server fedAt; awards husbandry XP.
 */
export function serverCollectEgg(
  state:     GameState,
  action:    { type: "chicken.collectEgg"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const chickenCount = Number(s.inventory.Chicken ?? 0);
  if (action.index < 0 || action.index >= chickenCount) {
    throw new Error("Chicken does not exist");
  }

  const chicken = s.chickens[action.index];
  if (!chicken?.fedAt) throw new Error("Chicken has not been fed");
  if (createdAt - chicken.fedAt < CHICKEN_TIME_TO_EGG) throw new Error("Egg is not ready yet");

  const bonus      = s.bonus ?? { ...INITIAL_BONUS };
  const yieldMult  = 1 + (bonus.produceYield ?? 0);
  const doubled    = Math.random() < (bonus.produceDouble ?? 0);
  const eggAmount  = Math.floor((chicken.multiplier || 1) * yieldMult) * (doubled ? 2 : 1);

  const currentEggs  = new Decimal((s.inventory as Record<string, Decimal>).Egg ?? 0);
  const newHusbXP    = (s.skills.husbandry ?? 0) + getSkillXP("collect_egg");
  const newSkills    = { ...s.skills, husbandry: newHusbXP };
  const oldLevel     = getSkillLevel(s.skills.husbandry ?? 0);
  const newLevel     = getSkillLevel(newHusbXP);
  const newBonus     = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(newSkills, s.ownedCollectibles)
    : bonus;

  return {
    ...s,
    inventory: { ...s.inventory, Egg: currentEggs.add(eggAmount) },
    chickens:  { ...s.chickens, [action.index]: { fedAt: undefined, multiplier: 1 } },
    skills:    newSkills,
    bonus:     newBonus,
    activity:  trackActivity(s.activity, "Egg Collected", eggAmount),
  };
}

/**
 * serverCollectMilk — §2.4-B
 * Mirrors collectMilk.ts. Uses server fedAt; awards husbandry XP.
 */
export function serverCollectMilk(
  state:     GameState,
  action:    { type: "cow.collectMilk"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const cowCount = Number(s.inventory.Cow ?? 0);
  if (action.index < 0 || action.index >= cowCount) throw new Error("Cow does not exist");

  const cow = s.cows[action.index];
  if (!cow?.fedAt) throw new Error("Cow has not been fed");
  if (createdAt - cow.fedAt < COW_TIME_TO_MILK) throw new Error("Milk is not ready yet");

  const bonus       = s.bonus ?? { ...INITIAL_BONUS };
  const yieldMult   = 1 + (bonus.produceYield ?? 0);
  const doubled     = Math.random() < (bonus.produceDouble ?? 0);
  const milkAmount  = Math.floor((cow.multiplier || 1) * yieldMult) * (doubled ? 2 : 1);

  const currentMilk  = new Decimal((s.inventory as Record<string, Decimal>).Milk ?? 0);
  const newHusbXP    = (s.skills.husbandry ?? 0) + getSkillXP("collect_milk");
  const newSkills    = { ...s.skills, husbandry: newHusbXP };
  const oldLevel     = getSkillLevel(s.skills.husbandry ?? 0);
  const newLevel     = getSkillLevel(newHusbXP);
  const newBonus     = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(newSkills, s.ownedCollectibles)
    : bonus;

  return {
    ...s,
    inventory: { ...s.inventory, Milk: currentMilk.add(milkAmount) },
    cows:      { ...s.cows, [action.index]: { fedAt: undefined, multiplier: 1 } },
    skills:    newSkills,
    bonus:     newBonus,
    activity:  trackActivity(s.activity, "Milk Collected", milkAmount),
  };
}

/**
 * serverCollectWool — §2.4-B
 * Mirrors collectWool.ts. Uses server fedAt; awards husbandry XP.
 */
export function serverCollectWool(
  state:     GameState,
  action:    { type: "sheep.collectWool"; index: number },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  const sheepCount = Number(s.inventory.Sheep ?? 0);
  if (action.index < 0 || action.index >= sheepCount) throw new Error("Sheep does not exist");

  const sheep = s.sheep[action.index];
  if (!sheep?.fedAt) throw new Error("Sheep has not been fed");
  if (createdAt - sheep.fedAt < SHEEP_TIME_TO_WOOL) throw new Error("Wool is not ready yet");

  const bonus       = s.bonus ?? { ...INITIAL_BONUS };
  const yieldMult   = 1 + (bonus.produceYield ?? 0);
  const doubled     = Math.random() < (bonus.produceDouble ?? 0);
  const woolAmount  = Math.floor((sheep.multiplier || 1) * yieldMult) * (doubled ? 2 : 1);

  const currentWool  = new Decimal((s.inventory as Record<string, Decimal>).Wool ?? 0);
  const newHusbXP    = (s.skills.husbandry ?? 0) + getSkillXP("collect_wool");
  const newSkills    = { ...s.skills, husbandry: newHusbXP };
  const oldLevel     = getSkillLevel(s.skills.husbandry ?? 0);
  const newLevel     = getSkillLevel(newHusbXP);
  const newBonus     = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(newSkills, s.ownedCollectibles)
    : bonus;

  return {
    ...s,
    inventory: { ...s.inventory, Wool: currentWool.add(woolAmount) },
    sheep:     { ...s.sheep, [action.index]: { fedAt: undefined, multiplier: 1 } },
    skills:    newSkills,
    bonus:     newBonus,
    activity:  trackActivity(s.activity, "Wool Collected", woolAmount),
  };
}

// ---------------------------------------------------------------------------
// §2.4-C  Server-side fishing validator
// ---------------------------------------------------------------------------

/**
 * serverCatchFish — §2.4-C
 * Mirrors catchFish.ts. Uses server fishing.lastCastAt; awards fishing XP.
 * Stamina cost = 3 ("fish_cast").
 */
export function serverCatchFish(
  state:     GameState,
  action:    { type: "fish.caught"; createdAt: number },
  _createdAt: number = Date.now(),
): GameState {
  // catchFish embeds createdAt in the action body (not as the outer param)
  const createdAt = action.createdAt;
  const s         = applyStaminaRegen(state, createdAt);

  if (!hasEnoughStamina(s.stamina.current, "fish_cast")) {
    throw new Error("Not enough stamina to fish");
  }

  const previousCooldown = s.fishing.cooldownMs ?? FISHING_BASE_COOLDOWN_MS;
  if (createdAt - (s.fishing.lastCastAt ?? 0) < previousCooldown) {
    throw new Error("Fishing is on cooldown");
  }
  const effectiveCooldown = Math.max(
    FISHING_MIN_COOLDOWN_MS,
    getReducedDuration(FISHING_BASE_COOLDOWN_MS, s.bonus?.fishSpeed ?? 0),
  );

  const fishingXP    = s.skills.fishing ?? 0;
  const fishingLevel = getSkillLevel(fishingXP);

  // §2.5-D — verify the server-computed fishing level can catch at least one fish.
  // FISH_TABLE is sorted by minLevel ascending; Anchovy/Sardine/Tilapia/Herring
  // require level 0, so any player can fish — this guard is future-proof in case
  // a minimum fishing level is introduced.
  const minRequired = Math.min(...FISH_TABLE.map((f) => f.minLevel));
  if (fishingLevel < minRequired) {
    throw new Error(`Requires Fishing Level ${minRequired} to fish`);
  }

  const caught       = rollCatch(fishingLevel);

  const bonus    = s.bonus ?? { ...INITIAL_BONUS };
  let amount     = Math.max(1, Math.floor(1 * (1 + (bonus.fishYield ?? 0))));
  if (Math.random() < (bonus.fishDouble ?? 0)) amount *= 2;

  const catchXP      = getSkillXP("catch_fish");
  const newFishingXP = fishingXP + catchXP;
  const oldLevel     = getSkillLevel(fishingXP);
  const newLevel     = getSkillLevel(newFishingXP);
  const newBonus     = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(
        { ...s.skills, fishing: newFishingXP },
        s.ownedCollectibles,
      )
    : bonus;

  const current = new Decimal((s.inventory as Record<string, Decimal>)[caught] ?? 0);

  return {
    ...s,
    inventory: { ...s.inventory, [caught]: current.add(amount) },
    skills:    { ...s.skills, fishing: newFishingXP },
    bonus:     newBonus,
    stamina:   { ...s.stamina, current: deductStamina(s.stamina.current, "fish_cast") },
    fishing: {
      lastCastAt:       createdAt,
      cooldownMs:       effectiveCooldown,
      lastCaughtFish:   caught,
      lastCaughtAmount: amount,
      totalCasts:       (s.fishing.totalCasts ?? 0) + 1,
      totalCaught:      (s.fishing.totalCaught ?? 0) + 1,
    },
    activity: trackActivity(s.activity, "Fish Caught", 1),
  };
}

// ---------------------------------------------------------------------------
// §2.4-D  Server-side cooking validators
// ---------------------------------------------------------------------------

/**
 * serverStartCooking — §2.4-D
 * Mirrors startCooking.ts. Validates kitchen empty, recipe ingredients in
 * server inventory. Deducts ingredients, sets cooking slot.
 */
export function serverStartCooking(
  state:     GameState,
  action:    { type: "food.startCooking"; item: Food },
  createdAt: number = Date.now(),
): GameState {
  const s = applyStaminaRegen(state, createdAt);

  if (s.cooking !== null) throw new Error("Kitchen is already busy");

  const recipe = FOODS()[action.item];
  if (!recipe) throw new Error("Unknown food item");

  // Deduct ingredients from server inventory
  const subtractedInventory = recipe.ingredients.reduce(
    (inv, ingredient) => {
      const have = new Decimal((inv as Record<string, Decimal>)[ingredient.item] ?? 0);
      const need = ingredient.amount instanceof Decimal
        ? ingredient.amount
        : new Decimal(ingredient.amount);
      if (have.lessThan(need)) {
        throw new Error(`Not enough ingredients: ${ingredient.item}`);
      }
      return { ...inv, [ingredient.item]: have.sub(need) };
    },
    s.inventory,
  );

  const effectiveDuration = getRoundedReducedDuration(
    recipe.cookTime ?? 60,
    s.bonus?.cookingSpeed ?? 0,
  );

  const cookXP       = getCookXP(action.item);
  const newCookingXP = (s.skills.cooking ?? 0) + cookXP;
  const oldLevel     = getSkillLevel(s.skills.cooking ?? 0);
  const newLevel     = getSkillLevel(newCookingXP);
  const newBonus     = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(
        { ...s.skills, cooking: newCookingXP },
        s.ownedCollectibles,
      )
    : (s.bonus ?? { ...INITIAL_BONUS });

  return {
    ...s,
    inventory: subtractedInventory,
    cooking:   { item: action.item, startedAt: createdAt, duration: effectiveDuration },
    skills:    { ...s.skills, cooking: newCookingXP },
    bonus:     newBonus,
  };
}

/**
 * serverCollectCooked — §2.4-D
 * Mirrors collectCooked.ts. Validates slot non-null and duration elapsed.
 * Adds cooked food (+ possible double) to server inventory. Clears slot.
 */
export function serverCollectCooked(
  state:     GameState,
  _action:   { type: "food.collectCooked" },
  createdAt: number = Date.now(),
): GameState {
  const s    = applyStaminaRegen(state, createdAt);
  const slot = s.cooking;
  if (!slot) throw new Error("Nothing is cooking");

  // duration is stored in seconds by the Phaser collectCooked handler
  if (createdAt - slot.startedAt < slot.duration * 1000) {
    throw new Error("Food is not ready yet");
  }

  const bonus   = s.bonus ?? { ...INITIAL_BONUS };
  const doubled = Math.random() < (bonus.cookingDouble ?? 0);
  const amount  = doubled ? 2 : 1;
  const existing = new Decimal((s.inventory as Record<string, Decimal>)[slot.item] ?? 0);

  return {
    ...s,
    inventory: { ...s.inventory, [slot.item]: existing.add(amount) },
    cooking: null,
  };
}


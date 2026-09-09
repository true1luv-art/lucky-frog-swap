/**
 * features/game.test.ts
 *
 * Consolidated unit tests for the features/game/ engine layer.
 * Covers: animals, crops, fields, fishing, foods, milestones, quests,
 *         resources, skills, and stamina.
 */

import { describe, expect, it } from "vitest";

// ─── Imports ──────────────────────────────────────────────────────────────────

import { ANIMALS_CONFIG } from "@/features/game/animals";

import { CROPS_CONFIG } from "@/features/game/crops";
import type { CropName } from "@/features/game/crops";
import { SEEDS } from "@/features/types/gameplay/crops";

import {
  FIELD_LEVEL_REQUIREMENTS,
  getFieldLevelRequirement,
  isFieldUnlocked,
} from "@/features/game/fields";

import {
  FISH_TABLE,
  FISHING_ACTION_MS,
  FISHING_MIN_ACTION_MS,
} from "@/features/game/fishing";

import { FOODS_CONFIG } from "@/features/game/foods";
import type { FoodName } from "@/features/game/foods";

import {
  trackMilestone,
  withMilestone,
  getMilestoneCount,
  getMilestoneProgress,
  getMilestonesByCategory,
  MILESTONES,
} from "@/features/game/milestones";
import type { MilestoneCategory } from "@/features/game/milestones";
import type { Milestones } from "@/features/types/gameplay/milestones";
import type { GameState } from "@/features/types/gameplay/game";

import {
  QUEST_RESOURCE_POOLS,
  QUEST_AMOUNT_BANDS,
  DAILY_QUEST_CATEGORIES,
  bandForXp,
  rollRequired,
  rollResource,
} from "@/features/game/quests";
import type { QuestCategory } from "@/features/types/quests";

import {
  TREE_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
} from "@/features/game/resources";

import { getSkillLevel, xpForNextLevel } from "@/features/game/skills";

import { STAMINA_CONSTANTS, STAMINA_COSTS } from "@/features/game/stamina";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal GameState stub — only the fields milestones.ts cares about. */
function makeState(milestones: Milestones = {}): GameState {
  return { milestones } as unknown as GameState;
}

/** A seeded rng that always returns a fixed value in [0, 1). */
const rng = (val: number) => () => val;

// =============================================================================
// ANIMALS
// =============================================================================

describe("ANIMALS_CONFIG", () => {
  it("defines Chicken, Cow, Sheep", () => {
    expect(ANIMALS_CONFIG.Chicken).toBeDefined();
    expect(ANIMALS_CONFIG.Cow).toBeDefined();
    expect(ANIMALS_CONFIG.Sheep).toBeDefined();
  });

  it("Chicken feeds on Wheat", () => {
    expect(ANIMALS_CONFIG.Chicken.feedItem).toBe("Wheat");
  });

  it("Cow feeds on Kale", () => {
    expect(ANIMALS_CONFIG.Cow.feedItem).toBe("Kale");
  });

  it("Sheep feeds on Cabbage", () => {
    expect(ANIMALS_CONFIG.Sheep.feedItem).toBe("Cabbage");
  });

  it("Chicken produce = Egg", () => {
    expect(ANIMALS_CONFIG.Chicken.produceItem).toBe("Egg");
  });

  it("Cow produce = Milk", () => {
    expect(ANIMALS_CONFIG.Cow.produceItem).toBe("Milk");
  });

  it("Sheep produce = Wool", () => {
    expect(ANIMALS_CONFIG.Sheep.produceItem).toBe("Wool");
  });

  it("all animals have maxCount > 0", () => {
    for (const a of Object.values(ANIMALS_CONFIG)) {
      expect(a.maxCount).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// CROPS
// =============================================================================

const EXPECTED_CROPS: CropName[] = [
  "Potato", "Carrot", "Cabbage", "Pumpkin", "Beetroot",
  "Parsnip", "Radish", "Cauliflower", "Wheat", "Kale",
];

describe("CROPS_CONFIG", () => {
  it("defines exactly 10 crops", () => {
    expect(Object.keys(CROPS_CONFIG)).toHaveLength(10);
  });

  it.each(EXPECTED_CROPS)("has entry for %s", (name) => {
    expect(CROPS_CONFIG[name]).toBeDefined();
  });

  it.each(EXPECTED_CROPS)("%s sellPrice > buyPrice", (name) => {
    const c = CROPS_CONFIG[name];
    expect(c.sellPrice).toBeGreaterThan(c.buyPrice);
  });

  it.each(EXPECTED_CROPS)("%s harvestSeconds > 0", (name) => {
    expect(CROPS_CONFIG[name].harvestSeconds).toBeGreaterThan(0);
  });

  it("Potato has harvestSeconds = 60", () => {
    expect(CROPS_CONFIG.Potato.harvestSeconds).toBe(60);
  });

  it("Kale has harvestSeconds = 86400 (24 h)", () => {
    expect(CROPS_CONFIG.Kale.harvestSeconds).toBe(86_400);
  });

  it("uses the canonical level 0-15 seed progression", () => {
    expect(Object.fromEntries(
      EXPECTED_CROPS.map((name) => [name, CROPS_CONFIG[name].farmingLevelRequired]),
    )).toEqual({
      Potato: 0, Carrot: 1, Cabbage: 2, Pumpkin: 3, Beetroot: 5,
      Parsnip: 6, Radish: 8, Cauliflower: 10, Wheat: 12, Kale: 15,
    });
  });

  it("unlocks every seed by farming level 15", () => {
    expect(Math.max(...Object.values(CROPS_CONFIG).map((c) => c.farmingLevelRequired))).toBe(15);
  });

  it("derives seed market requirements from CROPS_CONFIG", () => {
    const seeds = SEEDS();
    for (const cropName of EXPECTED_CROPS) {
      expect(seeds[`${cropName} Seed`].farmLevelRequirement).toBe(
        CROPS_CONFIG[cropName].farmingLevelRequired,
      );
    }
  });
});

// =============================================================================
// FIELDS
// =============================================================================

describe("FIELD_LEVEL_REQUIREMENTS + isFieldUnlocked", () => {
  it("all 72 fields (0–71) have an entry", () => {
    for (let i = 0; i < 72; i++) {
      expect(FIELD_LEVEL_REQUIREMENTS[i]).toBeDefined();
    }
  });

  it("fields 0–5 require level 0", () => {
    for (let i = 0; i <= 5; i++) {
      expect(getFieldLevelRequirement(i)).toBe(0);
    }
  });

  it("final row (fields 66–71) requires level 25", () => {
    for (let i = 66; i <= 71; i++) {
      expect(getFieldLevelRequirement(i)).toBe(25);
    }
  });

  it("level 0 unlocks fields 0–5 but not field 6", () => {
    expect(isFieldUnlocked(5, 0)).toBe(true);
    expect(isFieldUnlocked(6, 0)).toBe(false);
  });

  it("level 2 unlocks fields 6–11 but not field 12", () => {
    expect(isFieldUnlocked(6, 2)).toBe(true);
    expect(isFieldUnlocked(11, 2)).toBe(true);
    expect(isFieldUnlocked(12, 2)).toBe(false);
  });

  it("level 25 unlocks all 72 fields", () => {
    for (let i = 0; i < 72; i++) {
      expect(isFieldUnlocked(i, 25)).toBe(true);
    }
  });

  it("unknown field index defaults to 0 (always unlocked)", () => {
    expect(getFieldLevelRequirement(999)).toBe(0);
    expect(isFieldUnlocked(999, 0)).toBe(true);
  });
});

// =============================================================================
// FISHING
// =============================================================================

describe("FISH_TABLE", () => {
  it("has 14 entries", () => {
    expect(FISH_TABLE).toHaveLength(14);
  });

  it("first fish has minLevel 0", () => {
    expect(FISH_TABLE[0].minLevel).toBe(0);
  });

  it("last fish (Oarfish) has minLevel 90", () => {
    const oarfish = FISH_TABLE.find((f) => f.name === "Oarfish");
    expect(oarfish?.minLevel).toBe(90);
  });

  it("weights are strictly decreasing (rarer fish weigh less)", () => {
    for (let i = 1; i < FISH_TABLE.length; i++) {
      expect(FISH_TABLE[i].weight).toBeLessThan(FISH_TABLE[i - 1].weight);
    }
  });

  it("all sell prices > 0", () => {
    for (const f of FISH_TABLE) {
      expect(f.sellPrice).toBeGreaterThan(0);
    }
  });
});

describe("Fishing cooldown constants", () => {
  it("base cooldown > min cooldown", () => {
    expect(FISHING_BASE_COOLDOWN_MS).toBeGreaterThan(FISHING_MIN_COOLDOWN_MS);
  });

  it("FISHING_BASE_COOLDOWN_MS = 30000 (30 s)", () => {
    expect(FISHING_BASE_COOLDOWN_MS).toBe(30_000);
  });

  it("FISHING_MIN_COOLDOWN_MS = 15000 (15 s)", () => {
    expect(FISHING_MIN_COOLDOWN_MS).toBe(15_000);
  });
});

// =============================================================================
// FOODS
// =============================================================================

const EXPECTED_FOODS: FoodName[] = [
  "Roasted Potato", "Carrot Stew", "Cabbage Roll", "Pumpkin Soup",
  "Beetroot Salad", "Parsnip Porridge", "Radish Skewers",
  "Cauliflower Sandwich", "Wheat Bread", "Kale Stir-fry",
];

describe("FOODS_CONFIG", () => {
  it("defines exactly 10 recipes", () => {
    expect(Object.keys(FOODS_CONFIG)).toHaveLength(10);
  });

  it.each(EXPECTED_FOODS)("has entry for %s", (name) => {
    expect(FOODS_CONFIG[name]).toBeDefined();
  });

  it.each(EXPECTED_FOODS)("%s has cookTimeSeconds > 0", (name) => {
    expect(FOODS_CONFIG[name].cookTimeSeconds).toBeGreaterThan(0);
  });

  it.each(EXPECTED_FOODS)("%s has at least one ingredient", (name) => {
    expect(FOODS_CONFIG[name].ingredients.length).toBeGreaterThan(0);
  });

  it("Roasted Potato cookTimeSeconds = 30", () => {
    expect(FOODS_CONFIG["Roasted Potato"].cookTimeSeconds).toBe(30);
  });

  it("cook times are strictly increasing across recipes", () => {
    const times = EXPECTED_FOODS.map((n) => FOODS_CONFIG[n].cookTimeSeconds);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });
});

// =============================================================================
// MILESTONES
// =============================================================================

describe("trackMilestone", () => {
  it("initialises a missing key to the given amount", () => {
    expect(trackMilestone(undefined, "Crop Harvested", 1)["Crop Harvested"]).toBe(1);
  });

  it("initialises from an empty map", () => {
    expect(trackMilestone({}, "Tree Chopped", 5)["Tree Chopped"]).toBe(5);
  });

  it("accumulates across multiple calls", () => {
    let m = trackMilestone(undefined, "Fish Caught", 1);
    m      = trackMilestone(m, "Fish Caught", 1);
    m      = trackMilestone(m, "Fish Caught", 1);
    expect(m["Fish Caught"]).toBe(3);
  });

  it("does not mutate the original map", () => {
    const original: Milestones = { "Stone Mined": 10 };
    const result = trackMilestone(original, "Stone Mined", 5);
    expect(original["Stone Mined"]).toBe(10);
    expect(result["Stone Mined"]).toBe(15);
  });

  it("preserves unrelated keys", () => {
    const m = trackMilestone({ "Coins Earned": 500 }, "Iron Mined", 2);
    expect(m["Coins Earned"]).toBe(500);
    expect(m["Iron Mined"]).toBe(2);
  });

  it("adds fractional amounts (from Decimal.toNumber())", () => {
    expect(trackMilestone({}, "Coins Earned", 12.5)["Coins Earned"]).toBeCloseTo(12.5);
  });
});

describe("withMilestone", () => {
  it("reads from GameState.milestones and increments", () => {
    expect(withMilestone(makeState({ "Seed Planted": 3 }), "Seed Planted")["Seed Planted"]).toBe(4);
  });

  it("defaults amount to 1", () => {
    expect(withMilestone(makeState({}), "Animal Fed")["Animal Fed"]).toBe(1);
  });

  it("accepts explicit amount", () => {
    expect(withMilestone(makeState({ "Egg Collected": 10 }), "Egg Collected", 7)["Egg Collected"]).toBe(17);
  });

  it("does not mutate GameState", () => {
    const state = makeState({ "Milk Collected": 2 });
    withMilestone(state, "Milk Collected", 10);
    expect(state.milestones["Milk Collected"]).toBe(2);
  });
});

describe("getMilestoneCount", () => {
  it("returns 0 when milestones is undefined", () => {
    expect(getMilestoneCount(undefined, "Gold Mined")).toBe(0);
  });

  it("returns 0 when key is absent", () => {
    expect(getMilestoneCount({}, "Tuna Caught")).toBe(0);
  });

  it("returns the stored value", () => {
    expect(getMilestoneCount({ "Food Cooked": 42 }, "Food Cooked")).toBe(42);
  });
});

describe("MILESTONES definition", () => {
  it("is non-empty", () => {
    expect(MILESTONES.length).toBeGreaterThan(0);
  });

  it("every entry has a non-empty key, label, and category", () => {
    for (const m of MILESTONES) {
      expect(m.key.length).toBeGreaterThan(0);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.category.length).toBeGreaterThan(0);
    }
  });

  it("keys are unique", () => {
    const keys = MILESTONES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("all 6 categories are represented", () => {
    const expected: MilestoneCategory[] = [
      "farming", "resources", "animals", "fishing", "cooking", "economy",
    ];
    const present = new Set(MILESTONES.map((m) => m.category));
    for (const cat of expected) expect(present.has(cat)).toBe(true);
  });

  it("economy category contains all 5 coin keys", () => {
    const economyKeys = MILESTONES.filter((m) => m.category === "economy").map((m) => m.key);
    expect(economyKeys).toContain("Coins Earned");
    expect(economyKeys).toContain("Coins Spent");
    expect(economyKeys).toContain("Coins Deposited");
    expect(economyKeys).toContain("Coins Withdrawn");
    expect(economyKeys).toContain("Coins Burned");
  });

  it("farming category contains all crop harvest keys", () => {
    const farmingKeys = MILESTONES.filter((m) => m.category === "farming").map((m) => m.key);
    expect(farmingKeys).toContain("Crop Harvested");
    expect(farmingKeys).toContain("Potato Harvested");
    expect(farmingKeys).toContain("Kale Harvested");
    expect(farmingKeys).toContain("Seed Planted");
  });
});

describe("getMilestoneProgress", () => {
  it("returns one entry per MILESTONES definition", () => {
    expect(getMilestoneProgress({})).toHaveLength(MILESTONES.length);
  });

  it("defaults count to 0 for every key when milestones is undefined", () => {
    for (const p of getMilestoneProgress(undefined)) expect(p.count).toBe(0);
  });

  it("reflects stored counts correctly", () => {
    const m: Milestones = { "Tree Chopped": 99, "Coins Earned": 10_000 };
    const progress = getMilestoneProgress(m);
    expect(progress.find((p) => p.definition.key === "Tree Chopped")?.count).toBe(99);
    expect(progress.find((p) => p.definition.key === "Coins Earned")?.count).toBe(10_000);
  });

  it("keys not in milestones map default to 0", () => {
    const progress = getMilestoneProgress({ "Gold Mined": 5 });
    expect(progress.find((p) => p.definition.key === "Iron Mined")?.count).toBe(0);
  });

  it("output preserves definition reference from MILESTONES", () => {
    const progress = getMilestoneProgress({});
    for (let i = 0; i < MILESTONES.length; i++) {
      expect(progress[i].definition).toBe(MILESTONES[i]);
    }
  });
});

describe("getMilestonesByCategory", () => {
  it("returns only entries matching the requested category", () => {
    for (const p of getMilestonesByCategory({}, "fishing")) {
      expect(p.definition.category).toBe("fishing");
    }
  });

  it("returns at least one entry per category", () => {
    const cats: MilestoneCategory[] = [
      "farming", "resources", "animals", "fishing", "cooking", "economy",
    ];
    for (const cat of cats) {
      expect(getMilestonesByCategory({}, cat).length).toBeGreaterThan(0);
    }
  });

  it("all farming entries sum to MILESTONES farming count", () => {
    const farmingCount = MILESTONES.filter((m) => m.category === "farming").length;
    expect(getMilestonesByCategory({}, "farming")).toHaveLength(farmingCount);
  });

  it("counts flow through from milestones map", () => {
    const m: Milestones = { "Salmon Caught": 7, "Tuna Caught": 3 };
    const fishing = getMilestonesByCategory(m, "fishing");
    expect(fishing.find((p) => p.definition.key === "Salmon Caught")?.count).toBe(7);
    expect(fishing.find((p) => p.definition.key === "Tuna Caught")?.count).toBe(3);
  });

  it("no economy entries appear in animals category", () => {
    for (const p of getMilestonesByCategory({}, "animals")) {
      expect(p.definition.category).not.toBe("economy");
    }
  });
});

// =============================================================================
// QUESTS
// =============================================================================

describe("QUEST_RESOURCE_POOLS", () => {
  it("every category has at least one resource", () => {
    for (const cat of DAILY_QUEST_CATEGORIES) {
      expect(QUEST_RESOURCE_POOLS[cat].length).toBeGreaterThan(0);
    }
  });

  it("farming pool contains all 10 crops", () => {
    const expected = [
      "Potato", "Carrot", "Cabbage", "Pumpkin", "Beetroot",
      "Parsnip", "Radish", "Cauliflower", "Wheat", "Kale",
    ];
    for (const crop of expected) expect(QUEST_RESOURCE_POOLS.farming).toContain(crop);
    expect(QUEST_RESOURCE_POOLS.farming).toHaveLength(10);
  });

  it("fishing pool contains all 14 fish", () => {
    const expected = [
      "Anchovy", "Sardine", "Tilapia", "Herring", "Trout",
      "Sea Bass", "Mackerel", "Salmon", "Red Snapper", "Barracuda",
      "Tuna", "Swordfish", "Blue Marlin", "Oarfish",
    ];
    for (const fish of expected) expect(QUEST_RESOURCE_POOLS.fishing).toContain(fish);
    expect(QUEST_RESOURCE_POOLS.fishing).toHaveLength(14);
  });

  it("mining pool contains Stone, Iron, Gold", () => {
    expect(QUEST_RESOURCE_POOLS.mining).toEqual(["Stone", "Iron", "Gold"]);
  });

  it("woodcutting pool contains only Wood", () => {
    expect(QUEST_RESOURCE_POOLS.woodcutting).toEqual(["Wood"]);
  });

  it("husbandry pool contains Egg, Milk, Wool", () => {
    expect(QUEST_RESOURCE_POOLS.husbandry).toEqual(["Egg", "Milk", "Wool"]);
  });

  it("no pool contains duplicates", () => {
    for (const cat of DAILY_QUEST_CATEGORIES) {
      const pool = QUEST_RESOURCE_POOLS[cat];
      expect(new Set(pool).size).toBe(pool.length);
    }
  });
});

describe("QUEST_AMOUNT_BANDS", () => {
  it("has exactly 4 bands", () => {
    expect(QUEST_AMOUNT_BANDS).toHaveLength(4);
  });

  it("difficulties are easy → normal → hard → expert in order", () => {
    expect(QUEST_AMOUNT_BANDS.map((b) => b.difficulty)).toEqual(["easy", "normal", "hard", "expert"]);
  });

  it("maxXp values are strictly ascending (last is Infinity)", () => {
    for (let i = 0; i < QUEST_AMOUNT_BANDS.length - 1; i++) {
      expect(QUEST_AMOUNT_BANDS[i].maxXp).toBeLessThan(QUEST_AMOUNT_BANDS[i + 1].maxXp);
    }
    expect(QUEST_AMOUNT_BANDS[QUEST_AMOUNT_BANDS.length - 1].maxXp).toBe(Infinity);
  });

  it("baseQty is a positive integer for each band", () => {
    for (const band of QUEST_AMOUNT_BANDS) {
      expect(band.baseQty).toBeGreaterThan(0);
      expect(Number.isInteger(band.baseQty)).toBe(true);
    }
  });

  it("skillXp increases with difficulty", () => {
    for (let i = 0; i < QUEST_AMOUNT_BANDS.length - 1; i++) {
      expect(QUEST_AMOUNT_BANDS[i].skillXp).toBeLessThan(QUEST_AMOUNT_BANDS[i + 1].skillXp);
    }
  });
});

describe("bandForXp", () => {
  it("0 XP → easy",                  () => expect(bandForXp(0).difficulty).toBe("easy"));
  it("499 XP → easy (upper bound)",  () => expect(bandForXp(499).difficulty).toBe("easy"));
  it("500 XP → normal (lower bound)",() => expect(bandForXp(500).difficulty).toBe("normal"));
  it("4999 XP → normal",             () => expect(bandForXp(4999).difficulty).toBe("normal"));
  it("5000 XP → hard (lower bound)", () => expect(bandForXp(5000).difficulty).toBe("hard"));
  it("24999 XP → hard",              () => expect(bandForXp(24999).difficulty).toBe("hard"));
  it("25000 XP → expert",            () => expect(bandForXp(25000).difficulty).toBe("expert"));
  it("1 000 000 XP → expert",        () => expect(bandForXp(1_000_000).difficulty).toBe("expert"));
});

describe("rollRequired", () => {
  it("never returns less than 1", () => {
    expect(rollRequired(0, rng(0))).toBeGreaterThanOrEqual(1);
  });

  it("at minimum rng (0) returns floor(0.75 × base)", () => {
    const band = bandForXp(0);
    expect(rollRequired(0, rng(0))).toBe(Math.max(1, Math.round(band.baseQty * 0.75)));
  });

  it("at maximum rng (0.9999) returns near ceil(1.25 × base)", () => {
    const band = bandForXp(500);
    expect(rollRequired(500, rng(0.9999))).toBe(Math.max(1, Math.round(band.baseQty * 1.25)));
  });

  it("at midpoint rng (0.5) returns exactly base", () => {
    const band = bandForXp(5000);
    expect(rollRequired(5000, rng(0.5))).toBe(band.baseQty);
  });

  it("result is always a positive integer", () => {
    for (let xp = 0; xp <= 30_000; xp += 1_000) {
      const result = rollRequired(xp, rng(Math.random()));
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    }
  });

  it("expert requires more than easy at midpoint rng", () => {
    expect(rollRequired(25_000, rng(0.5))).toBeGreaterThan(rollRequired(0, rng(0.5)));
  });
});

describe("rollResource", () => {
  const cats: QuestCategory[] = ["farming", "mining", "woodcutting", "fishing", "husbandry"];

  it("always returns a member of the category pool", () => {
    for (const cat of cats) {
      for (let i = 0; i < 20; i++) {
        expect(QUEST_RESOURCE_POOLS[cat]).toContain(rollResource(cat));
      }
    }
  });

  it("rng(0) picks the first pool entry", () => {
    for (const cat of cats) {
      expect(rollResource(cat, rng(0))).toBe(QUEST_RESOURCE_POOLS[cat][0]);
    }
  });

  it("rng(0.9999) picks the last pool entry", () => {
    for (const cat of cats) {
      const pool = QUEST_RESOURCE_POOLS[cat];
      expect(rollResource(cat, rng(0.9999))).toBe(pool[pool.length - 1]);
    }
  });

  it("woodcutting always returns Wood regardless of rng", () => {
    expect(rollResource("woodcutting", rng(0))).toBe("Wood");
    expect(rollResource("woodcutting", rng(0.5))).toBe("Wood");
    expect(rollResource("woodcutting", rng(0.9999))).toBe("Wood");
  });
});

// =============================================================================
// RESOURCES
// =============================================================================

describe("Resource recovery constants", () => {
  it("TREE_RECOVERY_SECONDS is a positive number",  () => expect(TREE_RECOVERY_SECONDS).toBeGreaterThan(0));
  it("STONE_RECOVERY_SECONDS is a positive number", () => expect(STONE_RECOVERY_SECONDS).toBeGreaterThan(0));
  it("stone takes longer to recover than trees", () => {
    expect(STONE_RECOVERY_SECONDS).toBeGreaterThan(TREE_RECOVERY_SECONDS);
  });
});

// =============================================================================
// SKILLS
// =============================================================================

describe("getSkillLevel", () => {
  it("0 XP → level 1", () => {
    expect(getSkillLevel(0)).toBe(1);
  });

  it("level 1 requires exactly BASE XP to reach level 2", () => {
    const needed = xpForNextLevel(1);
    expect(needed).toBe(500);
    expect(getSkillLevel(needed - 1)).toBe(1);
    expect(getSkillLevel(needed)).toBe(2);
  });

  it("large XP produces level > 1", () => {
    expect(getSkillLevel(100_000)).toBeGreaterThan(1);
  });

  it("xpForNextLevel is monotonically increasing", () => {
    for (let level = 2; level <= 30; level++) {
      expect(xpForNextLevel(level)).toBeGreaterThan(xpForNextLevel(level - 1));
    }
  });

  it("XP just below threshold stays at current level", () => {
    let total = 0;
    for (let l = 1; l < 5; l++) total += xpForNextLevel(l);
    expect(getSkillLevel(total - 1)).toBe(4);
    expect(getSkillLevel(total)).toBe(5);
  });
});

// =============================================================================
// STAMINA
// =============================================================================

describe("STAMINA_CONSTANTS", () => {
  it("DEFAULT_MAX_STAMINA = 100",         () => expect(STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA).toBe(100));
  it("STAMINA_REGEN_PERCENT = 0.05",      () => expect(STAMINA_CONSTANTS.STAMINA_REGEN_PERCENT).toBeCloseTo(0.05));
  it("REGEN_INTERVAL_MS = 3600000 (1 h)", () => expect(STAMINA_CONSTANTS.REGEN_INTERVAL_MS).toBe(3_600_000));
  it("MAX_OFFLINE_REGEN_INTERVALS = 8",   () => expect(STAMINA_CONSTANTS.MAX_OFFLINE_REGEN_INTERVALS).toBe(8));
});

describe("STAMINA_COSTS", () => {
  it("plant costs 0", () => {
    expect(STAMINA_COSTS.plant).toBe(0);
  });

  it("fish_cast costs 3", () => {
    expect(STAMINA_COSTS.fish_cast).toBe(3);
  });

  it("all gathering actions cost 1", () => {
    const actions = [
      "harvest_crop", "harvest_resource", "chop_tree",
      "mine_stone", "mine_iron", "mine_gold",
    ] as const;
    for (const action of actions) {
      expect(STAMINA_COSTS[action]).toBe(1);
    }
  });
});

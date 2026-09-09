/**
 * shared/data/farming.test.ts
 *
 * Unit tests for shared/data/farming.ts — Sprint 2.1 §2.1-E / §2.1-C
 *
 * Covers:
 *   - CROPS_CONFIG integrity (all 10 crops defined, prices > 0, sell > buy)
 *   - Resource recovery constants are positive integers
 *   - STAMINA_CONFIG values match Phaser constants
 *   - STAMINA_COSTS keys and values
 *   - ANIMALS_CONFIG integrity
 *   - FISH_TABLE length and order invariants
 *   - FOODS_CONFIG integrity (all 10 recipes, ingredient counts)
 *   - FIELD_LEVEL_REQUIREMENTS coverage (all 30 fields)
 *   - isFieldUnlocked / getFieldLevelRequirement
 *   - getSkillLevel XP thresholds
 *   - experienceForNextLevel monotone increase
 */

import { describe, expect, it } from "vitest";

import {
  CROPS_CONFIG,
  TREE_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
  IRON_RECOVERY_SECONDS,
  GOLD_RECOVERY_SECONDS,
  STAMINA_CONFIG,
  STAMINA_COSTS,
  ANIMALS_CONFIG,
  FISH_TABLE,
  FISHING_BASE_COOLDOWN_MS,
  FISHING_MIN_COOLDOWN_MS,
  FOODS_CONFIG,
  FIELD_LEVEL_REQUIREMENTS,
  getFieldLevelRequirement,
  isFieldUnlocked,
  getSkillLevel,
  experienceForNextLevel,
  getHalvedPrice,
} from "@/shared/data/farming";
import type { CropName, FoodName } from "@/shared/data/farming";
import { CROPS, SEEDS } from "@/shared/types/gameplay/crops";
import { getEmissionMultiplier } from "@/lib/modules/game-stats/halving";

// ---------------------------------------------------------------------------
// CROPS_CONFIG
// ---------------------------------------------------------------------------

describe("CROPS_CONFIG", () => {
  const EXPECTED_CROPS: CropName[] = [
    "Potato", "Carrot", "Cabbage", "Pumpkin", "Beetroot",
    "Parsnip", "Radish", "Cauliflower", "Wheat", "Kale",
  ];

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
      Potato: 0,
      Carrot: 1,
      Cabbage: 2,
      Pumpkin: 3,
      Beetroot: 5,
      Parsnip: 6,
      Radish: 8,
      Cauliflower: 10,
      Wheat: 12,
      Kale: 15,
    });
  });

  it("unlocks every seed by farming level 15", () => {
    expect(Math.max(...Object.values(CROPS_CONFIG).map((crop) => crop.farmingLevelRequired))).toBe(15);
  });

  it("derives seed market requirements from CROPS_CONFIG", () => {
    const seeds = SEEDS();
    for (const cropName of EXPECTED_CROPS) {
      expect(seeds[`${cropName} Seed`].levelRequirement).toBe(
        CROPS_CONFIG[cropName].farmingLevelRequired,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Resource recovery constants
// ---------------------------------------------------------------------------

describe("Resource recovery constants", () => {
  it("TREE_RECOVERY_SECONDS = 900 (15 min)", () => {
    expect(TREE_RECOVERY_SECONDS).toBe(900);
  });

  it("STONE_RECOVERY_SECONDS = 3600 (1 h)", () => {
    expect(STONE_RECOVERY_SECONDS).toBe(3_600);
  });

  it("IRON_RECOVERY_SECONDS = 43200 (12 h)", () => {
    expect(IRON_RECOVERY_SECONDS).toBe(43_200);
  });

  it("GOLD_RECOVERY_SECONDS = 86400 (24 h)", () => {
    expect(GOLD_RECOVERY_SECONDS).toBe(86_400);
  });

  it("recovery times are strictly increasing", () => {
    const times = [
      TREE_RECOVERY_SECONDS,
      STONE_RECOVERY_SECONDS,
      IRON_RECOVERY_SECONDS,
      GOLD_RECOVERY_SECONDS,
    ];
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// STAMINA_CONFIG
// ---------------------------------------------------------------------------

describe("STAMINA_CONFIG", () => {
  it("max = 100", () => {
    expect(STAMINA_CONFIG.max).toBe(100);
  });

  it("regenPercent = 0.05", () => {
    expect(STAMINA_CONFIG.regenPercent).toBeCloseTo(0.05);
  });

  it("regenIntervalMs = 3600000 (1 h)", () => {
    expect(STAMINA_CONFIG.regenIntervalMs).toBe(3_600_000);
  });

  it("maxOfflineIntervals = 8", () => {
    expect(STAMINA_CONFIG.maxOfflineIntervals).toBe(8);
  });
});

describe("STAMINA_COSTS", () => {
  it("plant costs 0", () => {
    expect(STAMINA_COSTS.plant).toBe(0);
  });

  it("fish_cast costs 3", () => {
    expect(STAMINA_COSTS.fish_cast).toBe(3);
  });

  it("all gathering actions cost 1", () => {
    const gatheringActions = [
      "harvest_crop", "harvest_resource", "chop_tree",
      "mine_stone", "mine_iron", "mine_gold",
    ] as const;
    for (const action of gatheringActions) {
      expect(STAMINA_COSTS[action]).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// ANIMALS_CONFIG
// ---------------------------------------------------------------------------

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

  it("farmingLevelRequired: Chicken=3, Cow=6, Sheep=8", () => {
    expect(ANIMALS_CONFIG.Chicken.farmingLevelRequired).toBe(3);
    expect(ANIMALS_CONFIG.Cow.farmingLevelRequired).toBe(6);
    expect(ANIMALS_CONFIG.Sheep.farmingLevelRequired).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// FISH_TABLE
// ---------------------------------------------------------------------------

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

  it("fishing cooldown: base > min", () => {
    expect(FISHING_BASE_COOLDOWN_MS).toBeGreaterThan(FISHING_MIN_COOLDOWN_MS);
  });
});

// ---------------------------------------------------------------------------
// FOODS_CONFIG
// ---------------------------------------------------------------------------

describe("FOODS_CONFIG", () => {
  const EXPECTED_FOODS: FoodName[] = [
    "Roasted Potato", "Carrot Stew", "Cabbage Roll", "Pumpkin Soup",
    "Beetroot Salad", "Parsnip Porridge", "Radish Skewers",
    "Cauliflower Sandwich", "Wheat Bread", "Kale Stir-fry",
  ];

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

// ---------------------------------------------------------------------------
// Field unlock requirements
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// getSkillLevel + experienceForNextLevel
// ---------------------------------------------------------------------------

describe("getSkillLevel", () => {
  it("0 XP → level 1", () => {
    expect(getSkillLevel(0)).toBe(1);
  });

  it("level 1 requires exactly BASE XP to reach level 2", () => {
    const needed = experienceForNextLevel(1); // = 500
    expect(needed).toBe(500);
    expect(getSkillLevel(needed - 1)).toBe(1);
    expect(getSkillLevel(needed)).toBe(2);
  });

  it("large XP produces level > 1", () => {
    expect(getSkillLevel(100_000)).toBeGreaterThan(1);
  });

  it("experienceForNextLevel is monotonically increasing", () => {
    for (let level = 2; level <= 30; level++) {
      expect(experienceForNextLevel(level)).toBeGreaterThan(experienceForNextLevel(level - 1));
    }
  });

  it("XP just below threshold stays at current level", () => {
    // Compute total XP needed for level 5
    let total = 0;
    for (let l = 1; l < 5; l++) total += experienceForNextLevel(l);
    expect(getSkillLevel(total - 1)).toBe(4);
    expect(getSkillLevel(total)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getHalvedPrice — halving-driven price adjustment (§5 Step 1, §8, §9)
// ---------------------------------------------------------------------------

describe("getHalvedPrice", () => {
  const STAGES = [1, 0.5, 0.25, 0.125, 0.0625];

  it("returns the base price unchanged at Genesis (multiplier 1)", () => {
    expect(getHalvedPrice(0.065, 1)).toBeCloseTo(0.065, 10);
  });

  it("Potato sell price is halved at stage 1", () => {
    const base = CROPS_CONFIG.Potato.sellPrice;   // 0.065
    const mul = getEmissionMultiplier(20_000_000); // 0.5
    expect(getHalvedPrice(base, mul)).toBeCloseTo(0.0325, 10);
  });

  it("scales linearly across every halving stage", () => {
    for (const mul of STAGES) {
      expect(getHalvedPrice(100, mul)).toBeCloseTo(100 * mul, 10);
    }
  });

  it("all crops keep sellPrice > buyPrice at every halving stage", () => {
    for (const mul of STAGES) {
      for (const crop of Object.values(CROPS_CONFIG)) {
        expect(getHalvedPrice(crop.sellPrice, mul)).toBeGreaterThan(
          getHalvedPrice(crop.buyPrice, mul),
        );
      }
    }
  });

  // §9 Edge Cases — invalid multipliers must never zero out or invert prices.
  it("treats a 0 multiplier as 1 (Genesis) to prevent zero-value items", () => {
    expect(getHalvedPrice(0.065, 0)).toBeCloseTo(0.065, 10);
  });

  it("treats negative or non-finite multipliers as 1", () => {
    expect(getHalvedPrice(0.065, -0.5)).toBeCloseTo(0.065, 10);
    expect(getHalvedPrice(0.065, Number.NaN)).toBeCloseTo(0.065, 10);
    expect(getHalvedPrice(0.065, Number.POSITIVE_INFINITY)).toBeCloseTo(0.065, 10);
  });
});

// ---------------------------------------------------------------------------
// Client-side CROPS()/SEEDS() halving scaling (§5 Step 4c)
// ---------------------------------------------------------------------------

describe("CROPS()/SEEDS() halving scaling", () => {
  it("defaults to Genesis pricing when no multiplier is passed", () => {
    expect(CROPS().Potato.buyPrice.toNumber()).toBeCloseTo(2.5, 10);
    expect(SEEDS()["Potato Seed"].price.toNumber()).toBeCloseTo(2.5, 10);
  });

  it("scales all crop buy/sell prices by the multiplier", () => {
    const scaled = CROPS(0.5);
    expect(scaled.Potato.buyPrice.toNumber()).toBeCloseTo(1.25, 10);
    expect(scaled.Potato.sellPrice.toNumber()).toBeCloseTo(2, 10);
    expect(scaled.Kale.sellPrice.toNumber()).toBeCloseTo(562.5, 10);
  });

  it("scales all seed prices by the multiplier", () => {
    const scaled = SEEDS(0.25);
    expect(scaled["Potato Seed"].price.toNumber()).toBeCloseTo(0.625, 10);
    expect(scaled["Kale Seed"].price.toNumber()).toBeCloseTo(100, 10);
  });
});

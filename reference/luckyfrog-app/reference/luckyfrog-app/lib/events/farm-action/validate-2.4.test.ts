/**
 * lib/events/farm-action/validate-2.4.test.ts
 *
 * Unit tests for Sprint 2.4 server-side validators:
 *   §2.4-A  serverFeedChicken / serverFeedCow / serverFeedSheep
 *   §2.4-B  serverCollectEgg / serverCollectMilk / serverCollectWool
 *   §2.4-C  serverCatchFish
 *   §2.4-D  serverStartCooking / serverCollectCooked
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS, INITIAL_SKILLS } from "@/shared/types/gameplay/skills";
import { INITIAL_BASE_STATS, INITIAL_EQUIPMENT, computeStats } from "@/shared/types/gameplay/equipment";
import { totalXpForLevel } from "@/shared/game/skills";
import {
  CHICKEN_TIME_TO_EGG,
  CHICKEN_RE_HUNGER_DELAY,
  COW_TIME_TO_MILK,
  COW_RE_HUNGER_DELAY,
  SHEEP_TIME_TO_WOOL,
  SHEEP_RE_HUNGER_DELAY,
  FISHING_BASE_COOLDOWN_MS,
} from "@/shared/game/constants";
import {
  serverFeedChicken,
  serverFeedCow,
  serverFeedSheep,
  serverCollectEgg,
  serverCollectMilk,
  serverCollectWool,
  serverCatchFish,
  serverStartCooking,
  serverCollectCooked,
} from "@/lib/events/farm-action/validate";

// ---------------------------------------------------------------------------
// Shared test state factory
// ---------------------------------------------------------------------------

const NOW = Date.now();

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(1000),
    fields:    {},
    inventory: {
      // defaults used across animal tests
      Chicken:  new Decimal(2),
      Cow:      new Decimal(1),
      Sheep:    new Decimal(1),
      Wheat:    new Decimal(5),
      Kale:     new Decimal(5),
      Cabbage:  new Decimal(5),
      // cooking ingredients
      Potato: new Decimal(10),
      Wood:   new Decimal(10),
      Stone:    new Decimal(10),
      Iron:     new Decimal(10),
    },
    trees:    {},
    stones:   {},
    iron:     {},
    gold:     {},
    chickens: {},
    cows:     {},
    sheep:    {},
    equipment: { ...INITIAL_EQUIPMENT },
    baseStats: { ...INITIAL_BASE_STATS },
    stats:     computeStats(INITIAL_BASE_STATS, INITIAL_EQUIPMENT),
    // §2.5-D — animal validators now enforce farming level gates.
    // Sheep requires level 8, so we default to level 10 XP to satisfy all gates.
    skills:    { ...INITIAL_SKILLS, farming: totalXpForLevel(10) },
    bonus:     { ...INITIAL_BONUS },
    stamina:   { current: 100, max: 100 },
    lastStaminaRegenAt: NOW,
    fishing: {
      lastCastAt:       0,
      lastCaughtFish:   null,
      lastCaughtAmount: 0,
      totalCasts:       0,
      totalCaught:      0,
    },
    cooking:      null,
    activity:     {},
    achievements: {},
    ...overrides,
    ownedCollectibles: overrides.ownedCollectibles ?? [],
  };
}

// ============================================================================
// §2.4-A  Animal feed
// ============================================================================

describe("serverFeedChicken (§2.4-A)", () => {
  it("feeds a hungry chicken and deducts Wheat", () => {
    const state  = makeState();
    const result = serverFeedChicken(state, { type: "chicken.feed", index: 0 }, NOW);
    expect(result.chickens[0].fedAt).toBe(NOW);
    expect(new Decimal(result.inventory.Wheat!).toNumber()).toBe(4);
    expect(result.activity["Animal Fed"]).toBe(1);
  });

  it("throws when chicken index is out of range", () => {
    // Only 2 chickens in inventory (indices 0 and 1)
    const state = makeState();
    expect(() => serverFeedChicken(state, { type: "chicken.feed", index: 2 }, NOW))
      .toThrow("Chicken does not exist");
  });

  it("throws when chicken is already fed and not re-hungry", () => {
    const state = makeState({
      chickens: { 0: { fedAt: NOW - 10_000, multiplier: 1 } }, // fed 10s ago, not re-hungry
    });
    expect(() => serverFeedChicken(state, { type: "chicken.feed", index: 0 }, NOW))
      .toThrow("Chicken is not hungry");
  });

  it("allows re-feeding when re-hunger delay has passed", () => {
    const fedAt = NOW - CHICKEN_TIME_TO_EGG - CHICKEN_RE_HUNGER_DELAY - 1000;
    const state = makeState({
      chickens: { 0: { fedAt, multiplier: 1 } },
    });
    const result = serverFeedChicken(state, { type: "chicken.feed", index: 0 }, NOW);
    expect(result.chickens[0].fedAt).toBe(NOW);
  });

  it("throws when there is not enough Wheat", () => {
    const state = makeState({ inventory: { ...makeState().inventory, Wheat: new Decimal(0) } });
    expect(() => serverFeedChicken(state, { type: "chicken.feed", index: 0 }, NOW))
      .toThrow("Not enough Wheat");
  });
});

describe("serverFeedCow (§2.4-A)", () => {
  it("feeds a hungry cow and deducts Kale", () => {
    const state  = makeState();
    const result = serverFeedCow(state, { type: "cow.feed", index: 0 }, NOW);
    expect(result.cows[0].fedAt).toBe(NOW);
    expect(new Decimal(result.inventory.Kale!).toNumber()).toBe(4);
  });

  it("throws when cow is already fed", () => {
    const state = makeState({ cows: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverFeedCow(state, { type: "cow.feed", index: 0 }, NOW))
      .toThrow("Cow is not hungry");
  });

  it("allows re-feeding after COW_RE_HUNGER_DELAY", () => {
    const fedAt = NOW - COW_TIME_TO_MILK - COW_RE_HUNGER_DELAY - 1000;
    const state = makeState({ cows: { 0: { fedAt, multiplier: 1 } } });
    const result = serverFeedCow(state, { type: "cow.feed", index: 0 }, NOW);
    expect(result.cows[0].fedAt).toBe(NOW);
  });

  it("throws with insufficient Kale", () => {
    const state = makeState({ inventory: { ...makeState().inventory, Kale: new Decimal(0) } });
    expect(() => serverFeedCow(state, { type: "cow.feed", index: 0 }, NOW))
      .toThrow("Not enough Kale");
  });
});

describe("serverFeedSheep (§2.4-A)", () => {
  it("feeds a hungry sheep and deducts Cabbage", () => {
    const state  = makeState();
    const result = serverFeedSheep(state, { type: "sheep.feed", index: 0 }, NOW);
    expect(result.sheep[0].fedAt).toBe(NOW);
    expect(new Decimal(result.inventory.Cabbage!).toNumber()).toBe(4);
  });

  it("throws when sheep is already fed", () => {
    const state = makeState({ sheep: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverFeedSheep(state, { type: "sheep.feed", index: 0 }, NOW))
      .toThrow("Sheep is not hungry");
  });

  it("allows re-feeding after SHEEP_RE_HUNGER_DELAY", () => {
    const fedAt = NOW - SHEEP_TIME_TO_WOOL - SHEEP_RE_HUNGER_DELAY - 1000;
    const state = makeState({ sheep: { 0: { fedAt, multiplier: 1 } } });
    const result = serverFeedSheep(state, { type: "sheep.feed", index: 0 }, NOW);
    expect(result.sheep[0].fedAt).toBe(NOW);
  });
});

// ============================================================================
// §2.4-B  Animal produce collection
// ============================================================================

describe("serverCollectEgg (§2.4-B)", () => {
  it("collects egg when time has elapsed and resets chicken", () => {
    const fedAt = NOW - CHICKEN_TIME_TO_EGG - 1000;
    const state = makeState({
      inventory: { ...makeState().inventory, Egg: new Decimal(0) },
      chickens:  { 0: { fedAt, multiplier: 1 } },
    });
    const result = serverCollectEgg(state, { type: "chicken.collectEgg", index: 0 }, NOW);
    expect(new Decimal(result.inventory.Egg!).toNumber()).toBeGreaterThanOrEqual(1);
    expect(result.chickens[0].fedAt).toBeUndefined();
    expect(result.skills.husbandry).toBeGreaterThan(0);
  });

  it("throws when chicken has not been fed", () => {
    const state = makeState({ chickens: {} }); // no fedAt
    expect(() => serverCollectEgg(state, { type: "chicken.collectEgg", index: 0 }, NOW))
      .toThrow("Chicken has not been fed");
  });

  it("throws when egg is not ready yet", () => {
    const state = makeState({ chickens: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverCollectEgg(state, { type: "chicken.collectEgg", index: 0 }, NOW))
      .toThrow("Egg is not ready yet");
  });

  it("throws when chicken index is out of range", () => {
    const fedAt = NOW - CHICKEN_TIME_TO_EGG - 1000;
    const state = makeState({ chickens: { 0: { fedAt, multiplier: 1 } } });
    expect(() => serverCollectEgg(state, { type: "chicken.collectEgg", index: 5 }, NOW))
      .toThrow("Chicken does not exist");
  });
});

describe("serverCollectMilk (§2.4-B)", () => {
  it("collects milk when time has elapsed and resets cow", () => {
    const fedAt = NOW - COW_TIME_TO_MILK - 1000;
    const state = makeState({
      inventory: { ...makeState().inventory, Milk: new Decimal(0) },
      cows:      { 0: { fedAt, multiplier: 1 } },
    });
    const result = serverCollectMilk(state, { type: "cow.collectMilk", index: 0 }, NOW);
    expect(new Decimal(result.inventory.Milk!).toNumber()).toBeGreaterThanOrEqual(1);
    expect(result.cows[0].fedAt).toBeUndefined();
    expect(result.skills.husbandry).toBeGreaterThan(0);
  });

  it("throws when milk is not ready yet", () => {
    const state = makeState({ cows: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverCollectMilk(state, { type: "cow.collectMilk", index: 0 }, NOW))
      .toThrow("Milk is not ready yet");
  });

  it("throws when cow has not been fed", () => {
    const state = makeState();
    expect(() => serverCollectMilk(state, { type: "cow.collectMilk", index: 0 }, NOW))
      .toThrow("Cow has not been fed");
  });

  it("throws when cow index is out of range", () => {
    const fedAt = NOW - COW_TIME_TO_MILK - 1000;
    const state = makeState({ cows: { 0: { fedAt, multiplier: 1 } } });
    expect(() => serverCollectMilk(state, { type: "cow.collectMilk", index: 3 }, NOW))
      .toThrow("Cow does not exist");
  });
});

describe("serverCollectWool (§2.4-B)", () => {
  it("collects wool when time has elapsed and resets sheep", () => {
    const fedAt = NOW - SHEEP_TIME_TO_WOOL - 1000;
    const state = makeState({
      inventory: { ...makeState().inventory, Wool: new Decimal(0) },
      sheep:     { 0: { fedAt, multiplier: 1 } },
    });
    const result = serverCollectWool(state, { type: "sheep.collectWool", index: 0 }, NOW);
    expect(new Decimal(result.inventory.Wool!).toNumber()).toBeGreaterThanOrEqual(1);
    expect(result.sheep[0].fedAt).toBeUndefined();
    expect(result.skills.husbandry).toBeGreaterThan(0);
  });

  it("throws when wool is not ready yet", () => {
    const state = makeState({ sheep: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverCollectWool(state, { type: "sheep.collectWool", index: 0 }, NOW))
      .toThrow("Wool is not ready yet");
  });

  it("throws when sheep has not been fed", () => {
    const state = makeState();
    expect(() => serverCollectWool(state, { type: "sheep.collectWool", index: 0 }, NOW))
      .toThrow("Sheep has not been fed");
  });
});

// ============================================================================
// §2.4-C  Fishing
// ============================================================================

describe("serverCatchFish (§2.4-C)", () => {
  const castAt = NOW - FISHING_BASE_COOLDOWN_MS - 1000; // well past cooldown

  it("catches a fish when off cooldown and has stamina", () => {
    const state = makeState({
      fishing: { lastCastAt: castAt, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
    });
    const result = serverCatchFish(
      state,
      { type: "fish.caught", createdAt: NOW },
    );
    expect(result.fishing.lastCastAt).toBe(NOW);
    expect(result.fishing.totalCasts).toBe(1);
    expect(result.fishing.totalCaught).toBe(1);
    expect(result.fishing.lastCaughtFish).not.toBeNull();
    expect(result.stamina.current).toBe(97); // 100 - 3
    expect(result.skills.fishing).toBeGreaterThan(0);
  });

  it("throws when fishing is still on cooldown", () => {
    const state = makeState({
      fishing: { lastCastAt: NOW - 5000, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
    });
    expect(() =>
      serverCatchFish(state, { type: "fish.caught", createdAt: NOW }),
    ).toThrow("Fishing is on cooldown");
  });

  it("throws when there is not enough stamina", () => {
    const state = makeState({
      stamina: { current: 2, max: 100 },
      fishing: { lastCastAt: castAt, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
    });
    expect(() =>
      serverCatchFish(state, { type: "fish.caught", createdAt: NOW }),
    ).toThrow("Not enough stamina");
  });

  it("increments totalCasts and totalCaught on each successful cast", () => {
    const state = makeState({
      fishing: { lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 5, totalCaught: 4 },
    });
    const result = serverCatchFish(state, { type: "fish.caught", createdAt: NOW });
    expect(result.fishing.totalCasts).toBe(6);
    expect(result.fishing.totalCaught).toBe(5);
  });

  it("only catches level-0 fish at fishing level 1", () => {
    // All fish with minLevel > 0 are excluded at level 1.
    // We can only validate that we DO get a fish (level-0 fish always eligible).
    const state = makeState({
      fishing: { lastCastAt: castAt, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
    });
    const result = serverCatchFish(state, { type: "fish.caught", createdAt: NOW });
    const LEVEL_0_FISH = ["Anchovy", "Sardine", "Tilapia", "Herring"];
    expect(LEVEL_0_FISH).toContain(result.fishing.lastCaughtFish);
  });
});

// ============================================================================
// §2.4-D  Cooking
// ============================================================================

describe("serverStartCooking (§2.4-D)", () => {
  it("starts cooking Roasted Potato and deducts ingredients", () => {
    const state = makeState();
    const result = serverStartCooking(
      state,
      { type: "food.startCooking", item: "Roasted Potato" },
      NOW,
    );
    expect(result.cooking).not.toBeNull();
    expect(result.cooking!.item).toBe("Roasted Potato");
    expect(result.cooking!.startedAt).toBe(NOW);
    // The crop ingredients are deducted.
    expect(new Decimal(result.inventory.Potato!).toNumber()).toBe(8);
    expect(result.skills.cooking).toBeGreaterThan(0);
  });

  it("throws when kitchen is already busy", () => {
    const state = makeState({
      cooking: { item: "Roasted Potato", startedAt: NOW - 5000, duration: 30 },
    });
    expect(() =>
      serverStartCooking(state, { type: "food.startCooking", item: "Carrot Stew" }, NOW),
    ).toThrow("Kitchen is already busy");
  });

  it("throws with an unknown food item", () => {
    const state = makeState();
    expect(() =>
      serverStartCooking(state, { type: "food.startCooking", item: "Mystery Dish" as never }, NOW),
    ).toThrow("Unknown food item");
  });

  it("throws when ingredients are insufficient", () => {
    const state = makeState({ inventory: { ...makeState().inventory, Potato: new Decimal(0) } });
    expect(() =>
      serverStartCooking(state, { type: "food.startCooking", item: "Roasted Potato" }, NOW),
    ).toThrow("Not enough ingredients");
  });

  it("applies cookingSpeed bonus to reduce effective duration", () => {
    const state = makeState({ bonus: { ...INITIAL_BONUS, cookingSpeed: 0.5 } });
    const result = serverStartCooking(
      state,
      { type: "food.startCooking", item: "Roasted Potato" },
      NOW,
    );
    // Roasted Potato cookTime = 30s; with 0.5 speed bonus → 15s
    expect(result.cooking!.duration).toBe(15);
  });
});

describe("serverCollectCooked (§2.4-D)", () => {
  it("collects cooked food once duration has elapsed", () => {
    // duration stored in seconds; Roasted Potato = 30s
    const state = makeState({
      inventory: { ...makeState().inventory, "Roasted Potato": new Decimal(0) },
      cooking: { item: "Roasted Potato", startedAt: NOW - 31_000, duration: 30 },
    });
    const result = serverCollectCooked(
      state,
      { type: "food.collectCooked" },
      NOW,
    );
    expect(result.cooking).toBeNull();
    expect(new Decimal(result.inventory["Roasted Potato"]!).toNumber()).toBeGreaterThanOrEqual(1);
  });

  it("throws when nothing is cooking", () => {
    const state = makeState();
    expect(() => serverCollectCooked(state, { type: "food.collectCooked" }, NOW))
      .toThrow("Nothing is cooking");
  });

  it("throws when food is not ready yet", () => {
    const state = makeState({
      cooking: { item: "Roasted Potato", startedAt: NOW - 5000, duration: 30 },
    });
    expect(() => serverCollectCooked(state, { type: "food.collectCooked" }, NOW))
      .toThrow("Food is not ready yet");
  });
});


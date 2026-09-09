/**
 * features/farm-action/farm-action.test.ts
 *
 * Consolidated unit tests for the server-side farm-action validators.
 *
 * The stamina system has been removed and cooking is now instant, so these
 * tests exercise the current RPG model:
 *   - buildServerGameState (ore tiers + equipment, no stamina)
 *   - inventoryDiff
 *   - serverPlant / serverHarvest
 *   - serverChop / serverMineStone / serverMineIron / serverMineEmerald /
 *     serverMineDiamond / serverMineIgnisite
 *   - field unlock gate
 *   - serverFeed* / serverCollect*
 *   - serverCatchFish
 *   - serverCookFood (instant)
 *
 * No MongoDB or DOM dependencies — all tests operate on plain objects.
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { buildServerGameState } from "./build-state";
import { inventoryDiff } from "./persist";
import {
  serverPlant,
  serverHarvest,
  serverChop,
  serverMineStone,
  serverFeedChicken,
  serverFeedCow,
  serverFeedSheep,
  serverCollectEgg,
  serverCollectMilk,
  serverCollectWool,
  serverCatchFish,
  serverCookFood,
} from "@/features/farm-action/validate";
import type { GameState } from "@/features/types/gameplay/game";
import { INITIAL_SKILLS } from "@/features/types/gameplay/skills";
import { totalXpForLevel } from "@/features/game/skills";
import { ANIMALS_CONFIG } from "@/features/game/animals";
import { FISHING_ACTION_MS } from "@/features/game/fishing";
import {
  TREE_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
} from "@/features/game/resources";
import type {
  IFarm,
  FieldNode,
  ResourceNode,
  AnimalNode,
  FishingState,
} from "@/lib/modules/farms/types.server";
import type { IInventory } from "@/lib/modules/items/types.server";
import type { IPlayer } from "@/lib/modules/players/types.server";
import type { PlayerSkills } from "@/features/types/players";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
const NOW     = 1_700_000_000_000; // fixed epoch for deterministic tests

// ---------------------------------------------------------------------------
// Helpers — build minimal stubs
// ---------------------------------------------------------------------------

function makeFarm(overrides: Partial<IFarm> = {}): IFarm {
  return {
    playerId:  "wallet123",
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    emerald:   {},
    diamond:   {},
    ignisite:  {},
    chickens:  {},
    cows:      {},
    sheep:     {},
    fishing:   { lastCastAt: 0, lastCaughtFish: null } as FishingState,
    milestones: {},
    createdAt:  new Date(),
    updatedAt:  new Date(),
    ...overrides,
  } as unknown as IFarm;
}

function makeInventory(overrides: Partial<IInventory> = {}): IInventory {
  return {
    playerId:  "wallet123",
    items:     {},
    balance:   0,
    updatedAt: new Date(),
    ...overrides,
  } as unknown as IInventory;
}

function makePlayer(skillsOverride: Partial<PlayerSkills> = {}): IPlayer {
  return {
    wallet:   "wallet123",
    username: "TestFarmer",
    skills: {
      farming: 0, woodcutting: 0, mining: 0, fishing: 0,
      husbandry: 0, combat: 0, cooking: 0, smithing: 0,
      ...skillsOverride,
    },
  } as unknown as IPlayer;
}

// ---------------------------------------------------------------------------
// Helpers — build minimal GameState
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    id:                 undefined,
    username:           undefined,
    avatarUrl:          undefined,
    balance:            new Decimal(1000),
    fields:             {},
    trees:              {},
    stones:             {},
    iron:               {},
    emerald:            {},
    diamond:            {},
    ignisite:           {},
    chickens:           {},
    cows:               {},
    sheep:              {},
    items: {
      Chicken: new Decimal(2),
      Cow:     new Decimal(1),
      Sheep:   new Decimal(1),
      Wheat:   new Decimal(5),
      Kale:    new Decimal(5),
      Cabbage: new Decimal(5),
      Potato:  new Decimal(10),
      Wood:    new Decimal(10),
      Stone:   new Decimal(10),
      Iron:    new Decimal(10),
    },
    farmAddress:        undefined,
    skills:             { ...INITIAL_SKILLS, farming: totalXpForLevel(10) },
    fishing:            { lastCastAt: 0, lastCaughtFish: null },
    milestones:         {},
    ...overrides,
  } as unknown as GameState;
}

function withSeeds(state: GameState, seedName: string, qty: number): GameState {
  return { ...state, items: { ...state.items, [seedName]: new Decimal(qty) } };
}

// Helper to call buildServerGameState with minimal tools/equipment for testing
function makeGameState(
  farm: IFarm | null = null,
  items: IInventory | null = null,
  player: IPlayer | null = null,
): GameState {
  return buildServerGameState(
    farm ?? makeFarm(),
    inventory ?? makeInventory(),
    player ?? makePlayer(),
    [], // toolDocs
    [], // armorPieces
    null, // equippedSet
  );
}

// ============================================================================
// buildServerGameState
// ============================================================================

describe("buildServerGameState", () => {
  it("returns a valid GameState from empty farm + inventory", () => {
    const state = makeGameState(makeFarm(), makeInventory(), makePlayer());
    expect(state.balance).toBeInstanceOf(Decimal);
    expect(state.balance.toNumber()).toBe(0);
    expect(state.fields).toEqual({});
    expect(state.items).toEqual({});
    expect(state.skills.farming).toBe(0);
  });

  it("initialises equipment for a new farm", () => {
    const state = makeGameState(makeFarm(), makeInventory(), makePlayer());
    expect(state.equipment).toBeDefined();
  });

  it("converts balance from MongoDB number to Decimal", () => {
    const state = makeGameState(makeFarm(), makeInventory({ balance: 42.5 }), makePlayer());
    expect(state.balance).toBeInstanceOf(Decimal);
    expect(state.balance.toNumber()).toBe(42.5);
  });

  it("converts items from MongoDB numbers to Decimal in inventory", () => {
    const inv   = makeInventory({ items: { Potato: 10, Wood: 5 } as Record<string, number> });
    const state = makeGameState(makeFarm(), inv, makePlayer());
    expect(state.items["Potato"]).toBeInstanceOf(Decimal);
    expect((state.items["Potato"] as Decimal).toNumber()).toBe(10);
    expect((state.items["Wood"] as Decimal).toNumber()).toBe(5);
  });

  it("excludes zero-quantity items from inventory", () => {
    const inv   = makeInventory({ items: { Potato: 0, Carrot: 3 } as Record<string, number> });
    const state = makeGameState(makeFarm(), inv, makePlayer());
    expect(state.items["Potato"]).toBeUndefined();
    expect((state.items["Carrot"] as Decimal).toNumber()).toBe(3);
  });

  it("maps fields from string keys to number keys", () => {
    const farm  = makeFarm({ fields: { "0": { name: "Potato", plantedAt: 1000 } as FieldNode, "5": { name: "Carrot", plantedAt: 2000 } as FieldNode } });
    const state = makeGameState(farm, makeInventory(), makePlayer());
    expect(state.fields[0].name).toBe("Potato");
    expect(state.fields[0].plantedAt).toBe(1000);
    expect(state.fields[5].name).toBe("Carrot");
  });

  it("maps trees with choppedAt from harvestedAt", () => {
    const farm  = makeFarm({ trees: { "0": { name: "Wood", harvestedAt: 9999 } as ResourceNode } });
    const state = makeGameState(farm, makeInventory(), makePlayer());
    expect(state.trees[0].choppedAt).toBe(9999);
  });

  it("maps ore nodes with minedAt from harvestedAt", () => {
    const farm  = makeFarm({ stones: { "1": { name: "Stone", harvestedAt: 8888 } as ResourceNode } });
    const state = makeGameState(farm, makeInventory(), makePlayer());
    expect(state.stones[1].minedAt).toBe(8888);
  });

  it("maps chickens from string keys to number keys", () => {
    const farm  = makeFarm({ chickens: { "0": { type: "Chicken", fedAt: 5000, multiplier: 1.2 } as AnimalNode } });
    const state = makeGameState(farm, makeInventory(), makePlayer());
    expect(state.chickens[0].fedAt).toBe(5000);
  });

  it("preserves woodcutting and farming skill XP", () => {
    const player = makePlayer({ woodcutting: 250, farming: 1500 });
    const state  = makeGameState(makeFarm(), makeInventory(), player);
    expect(state.skills.woodcutting).toBe(250);
    expect(state.skills.farming).toBe(1500);
  });

  it("sets fishing state from farm document", () => {
    const farm  = makeFarm({ fishing: { lastCastAt: 12345, lastCaughtFish: "Carp" } as FishingState });
    const state = makeGameState(farm, makeInventory(), makePlayer());
    expect(state.fishing.lastCastAt).toBe(12345);
    expect(state.fishing.lastCaughtFish).toBe("Carp");
  });

  it("returns default GameState when farm is null", () => {
    const state = makeGameState(null, makeInventory(), makePlayer());
    expect(state.fields).toEqual({});
    expect(state.equipment).toBeDefined();
  });

  it("returns default GameState when inventory is null", () => {
    const state = makeGameState(makeFarm(), null, makePlayer());
    expect(state.balance.toNumber()).toBe(0);
    expect(state.items).toEqual({});
  });

  it("username is populated from player document", () => {
    const state = makeGameState(makeFarm(), makeInventory(), makePlayer());
    expect(state.username).toBe("TestFarmer");
  });
});

// ============================================================================
// inventoryDiff
// ============================================================================

describe("inventoryDiff", () => {
  function inv(items: Record<string, number>) {
    const result: Record<string, Decimal> = {};
    for (const [k, v] of Object.entries(items)) result[k] = new Decimal(v);
    return result as unknown as import("@/features/types/gameplay/game").Inventory;
  }

  it("returns empty diffs when inventories are equal", () => {
    const { added, removed } = inventoryDiff(inv({ Potato: 5 }), inv({ Potato: 5 }));
    expect(added).toEqual({});
    expect(removed).toEqual({});
  });

  it("detects items added", () => {
    const { added, removed } = inventoryDiff(inv({}), inv({ Wood: 3 }));
    expect(added).toEqual({ Wood: 3 });
    expect(removed).toEqual({});
  });

  it("detects items removed", () => {
    const { added, removed } = inventoryDiff(inv({ Potato: 10 }), inv({ Potato: 7 }));
    expect(removed).toEqual({ Potato: 3 });
    expect(added).toEqual({});
  });

  it("handles item completely consumed", () => {
    const { added, removed } = inventoryDiff(inv({ "Potato Seed": 1 }), inv({}));
    expect(removed).toEqual({ "Potato Seed": 1 });
    expect(added).toEqual({});
  });

  it("handles multiple items simultaneously added and removed", () => {
    const { added, removed } = inventoryDiff(
      inv({ Potato: 5, Wood: 2, "Carrot Seed": 3 }),
      inv({ Potato: 8, Wood: 0, Carrot: 1 }),
    );
    expect(added).toEqual({ Potato: 3, Carrot: 1 });
    expect(removed).toEqual({ Wood: 2, "Carrot Seed": 3 });
  });

  it("handles empty old and new inventories", () => {
    const { added, removed } = inventoryDiff(inv({}), inv({}));
    expect(added).toEqual({});
    expect(removed).toEqual({});
  });

  it("treats fractional Decimal changes correctly", () => {
    const { added } = inventoryDiff(inv({ Emerald: 1 }), inv({ Emerald: 3 }));
    expect(added.Emerald).toBe(2);
  });
});

// ============================================================================
// serverPlant
// ============================================================================

describe("serverPlant", () => {
  it("plants a seed successfully", () => {
    const state = withSeeds(makeState(), "Potato Seed", 3);
    const next  = serverPlant(state, { type: "item.planted", item: "Potato Seed", index: 0 }, NOW);
    expect(next.fields[0].name).toBe("Potato");
    expect((next.items as Record<string, Decimal>)["Potato Seed"].toNumber()).toBe(2);
  });

  it("throws when field index is out of range", () => {
    const state = withSeeds(makeState(), "Potato Seed", 1);
    expect(() => serverPlant(state, { type: "item.planted", item: "Potato Seed", index: 72 }, NOW))
      .toThrow("Field does not exist");
  });

  it("throws when field is locked (requires higher farming level)", () => {
    const state = withSeeds(makeState({ skills: { ...INITIAL_SKILLS, farming: 0 } }), "Potato Seed", 1);
    expect(() => serverPlant(state, { type: "item.planted", item: "Potato Seed", index: 15 }, NOW))
      .toThrow("Farming Level");
  });

  it("throws when field is already occupied", () => {
    const state = withSeeds(makeState({ fields: { 0: { name: "Potato", plantedAt: NOW - 1000 } } }), "Potato Seed", 2);
    expect(() => serverPlant(state, { type: "item.planted", item: "Potato Seed", index: 0 }, NOW))
      .toThrow("already planted");
  });

  it("throws when no seed item is given", () => {
    expect(() => serverPlant(makeState(), { type: "item.planted", index: 0 }, NOW))
      .toThrow("No seed selected");
  });

  it("throws when a non-seed item is given", () => {
    const state = makeState({ items: { Wood: new Decimal(5) } } as Partial<GameState>);
    expect(() => serverPlant(state, { type: "item.planted", item: "Wood", index: 0 }, NOW))
      .toThrow("Not a seed");
  });

  it("throws when player does not have enough seeds", () => {
    const state = withSeeds(makeState(), "Potato Seed", 0);
    expect(() => serverPlant(state, { type: "item.planted", item: "Potato Seed", index: 0 }, NOW))
      .toThrow("Not enough seeds");
  });

  it("enforces seed farming level requirement", () => {
    const state = withSeeds(makeState({ skills: { ...INITIAL_SKILLS, farming: 0 } }), "Kale Seed", 1);
    expect(() => serverPlant(state, { type: "item.planted", item: "Kale Seed", index: 0 }, NOW))
      .toThrow("Seed requires Farming Level 15");
  });
});

// ============================================================================
// serverHarvest
// ============================================================================

const POTATO_GROW_MS = 60 * 1000;

describe("serverHarvest", () => {
  function makeHarvestState(plantedAt: number): GameState {
    return makeState({ fields: { 0: { name: "Potato", plantedAt } }, items: {} });
  }

  it("harvests a mature crop and adds to inventory", () => {
    const next = serverHarvest(makeHarvestState(NOW - POTATO_GROW_MS - 1000), { type: "item.harvested", index: 0 }, NOW);
    expect(next.fields[0]).toBeUndefined();
    expect((next.items as Record<string, Decimal>)["Potato"].greaterThan(0)).toBe(true);
  });

  it("awards farming XP", () => {
    const next = serverHarvest(makeHarvestState(NOW - POTATO_GROW_MS - 1000), { type: "item.harvested", index: 0 }, NOW);
    expect(next.skills.farming).toBeGreaterThan(0);
  });

  it("throws when crop is not yet mature", () => {
    expect(() => serverHarvest(makeHarvestState(NOW - POTATO_GROW_MS + 5000), { type: "item.harvested", index: 0 }, NOW))
      .toThrow("Not ready");
  });

  it("throws when field is empty", () => {
    expect(() => serverHarvest(makeState(), { type: "item.harvested", index: 0 }, NOW))
      .toThrow("Nothing was planted");
  });
});

// ============================================================================
// serverChop
// ============================================================================

describe("serverChop", () => {
  const TREE_RECOVERED_AT = NOW - TREE_RECOVERY_SECONDS * 1000 - 1000;

  function makeChopState(choppedAt: number): GameState {
    return makeState({ trees: { 0: { name: "Wood", choppedAt } } });
  }

  it("chops a recovered tree and adds Wood to inventory", () => {
    const next = serverChop(makeChopState(TREE_RECOVERED_AT), { type: "tree.chopped", index: 0 }, NOW);
    expect((next.items as Record<string, Decimal>)["Wood"]?.greaterThan(0)).toBe(true);
    expect(next.trees[0].choppedAt).toBe(NOW);
  });

  it("awards woodcutting XP", () => {
    const next = serverChop(makeChopState(TREE_RECOVERED_AT), { type: "tree.chopped", index: 0 }, NOW);
    expect(next.skills.woodcutting).toBeGreaterThan(0);
  });

  it("throws when tree is still growing", () => {
    // Chopped within the last few seconds — inside the recovery window.
    expect(() => serverChop(makeChopState(NOW - 1000), { type: "tree.chopped", index: 0 }, NOW))
      .toThrow("still growing");
  });

  it("throws when tree node does not exist", () => {
    expect(() => serverChop(makeState(), { type: "tree.chopped", index: 99 }, NOW))
      .toThrow("No tree");
  });
});

// ============================================================================
// serverMine* (ore tiers)
// ============================================================================

describe("serverMineStone", () => {
  const RECOVERED_AT = NOW - STONE_RECOVERY_SECONDS * 1000 - 1000;

  it("mines a recovered stone and adds Stone to inventory", () => {
    const state = makeState({ stones: { 0: { name: "Stone", minedAt: RECOVERED_AT } } });
    expect((serverMineStone(state, { type: "stone.mined", index: 0 }, NOW).items as Record<string, Decimal>)["Stone"]?.greaterThan(0)).toBe(true);
  });

  it("throws when stone is still recovering", () => {
    const state = makeState({ stones: { 0: { name: "Stone", minedAt: NOW - 1000 } } });
    expect(() => serverMineStone(state, { type: "stone.mined", index: 0 }, NOW)).toThrow("still recovering");
  });

  it("throws when no stone node exists", () => {
    expect(() => serverMineStone(makeState(), { type: "stone.mined", index: 0 }, NOW)).toThrow("No rock");
  });
});

// Ore drops are now determined by pickaxe tier rarity weights (see mine.test.ts).
// Separate ore node actions (iron.mined, emerald.mined, etc.) no longer exist.

// ============================================================================
// Field unlock gate
// ============================================================================

describe("field unlock gate", () => {
  const lockedCases: [number, number][] = [
    [6,  3],
    [9,  5],
    [15, 10],
    [24, 20],
    [27, 25],
  ];

  for (const [fieldIndex, requiredLevel] of lockedCases) {
    it(`blocks field ${fieldIndex} when farming level < ${requiredLevel}`, () => {
      const state = withSeeds(makeState({ skills: { ...INITIAL_SKILLS, farming: 0 } }), "Potato Seed", 5);
      expect(() => serverPlant(state, { type: "item.planted", item: "Potato Seed", index: fieldIndex }, NOW))
        .toThrow("Farming Level");
    });
  }

  it("fields 0–4 are always unlocked", () => {
    const state = withSeeds(makeState({ skills: { ...INITIAL_SKILLS, farming: 0 } }), "Potato Seed", 10);
    for (let i = 0; i <= 4; i++) {
      expect(() => serverPlant(state, { type: "item.planted", item: "Potato Seed", index: i }, NOW)).not.toThrow();
    }
  });
});

// ============================================================================
// Animal feed
// ============================================================================

describe("serverFeedChicken", () => {
  it("feeds a hungry chicken and deducts Wheat", () => {
    const result = serverFeedChicken(makeState(), { type: "chicken.feed", index: 0 }, NOW);
    expect(result.chickens[0].fedAt).toBe(NOW);
    expect(new Decimal(result.items.Wheat!).toNumber()).toBe(4);
    expect(result.milestones["Animal Fed"]).toBe(1);
  });

  it("throws when chicken index is out of range", () => {
    expect(() => serverFeedChicken(makeState(), { type: "chicken.feed", index: 2 }, NOW))
      .toThrow("Chicken does not exist");
  });

  it("throws when chicken is already fed and not re-hungry", () => {
    const state = makeState({ chickens: { 0: { fedAt: NOW - 10_000, multiplier: 1 } } });
    expect(() => serverFeedChicken(state, { type: "chicken.feed", index: 0 }, NOW))
      .toThrow("Chicken is not hungry");
  });

  it("allows re-feeding when re-hunger delay has passed", () => {
    const fedAt  = NOW - ANIMALS_CONFIG.Chicken.produceTimeMs - ANIMALS_CONFIG.Chicken.reHungerDelayMs - 1000;
    const result = serverFeedChicken(makeState({ chickens: { 0: { fedAt, multiplier: 1 } } }), { type: "chicken.feed", index: 0 }, NOW);
    expect(result.chickens[0].fedAt).toBe(NOW);
  });

  it("throws when there is not enough Wheat", () => {
    const state = makeState({ items: { ...makeState().items, Wheat: new Decimal(0) } });
    expect(() => serverFeedChicken(state, { type: "chicken.feed", index: 0 }, NOW))
      .toThrow("Not enough Wheat");
  });
});

describe("serverFeedCow", () => {
  it("feeds a hungry cow and deducts Kale", () => {
    const result = serverFeedCow(makeState(), { type: "cow.feed", index: 0 }, NOW);
    expect(result.cows[0].fedAt).toBe(NOW);
    expect(new Decimal(result.items.Kale!).toNumber()).toBe(4);
  });

  it("throws when cow is already fed", () => {
    const state = makeState({ cows: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverFeedCow(state, { type: "cow.feed", index: 0 }, NOW)).toThrow("Cow is not hungry");
  });

  it("allows re-feeding after re-hunger delay", () => {
    const fedAt  = NOW - ANIMALS_CONFIG.Cow.produceTimeMs - ANIMALS_CONFIG.Cow.reHungerDelayMs - 1000;
    const result = serverFeedCow(makeState({ cows: { 0: { fedAt, multiplier: 1 } } }), { type: "cow.feed", index: 0 }, NOW);
    expect(result.cows[0].fedAt).toBe(NOW);
  });

  it("throws with insufficient Kale", () => {
    const state = makeState({ items: { ...makeState().items, Kale: new Decimal(0) } });
    expect(() => serverFeedCow(state, { type: "cow.feed", index: 0 }, NOW)).toThrow("Not enough Kale");
  });
});

describe("serverFeedSheep", () => {
  it("feeds a hungry sheep and deducts Cabbage", () => {
    const result = serverFeedSheep(makeState(), { type: "sheep.feed", index: 0 }, NOW);
    expect(result.sheep[0].fedAt).toBe(NOW);
    expect(new Decimal(result.items.Cabbage!).toNumber()).toBe(4);
  });

  it("throws when sheep is already fed", () => {
    const state = makeState({ sheep: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverFeedSheep(state, { type: "sheep.feed", index: 0 }, NOW)).toThrow("Sheep is not hungry");
  });

  it("allows re-feeding after re-hunger delay", () => {
    const fedAt  = NOW - ANIMALS_CONFIG.Sheep.produceTimeMs - ANIMALS_CONFIG.Sheep.reHungerDelayMs - 1000;
    const result = serverFeedSheep(makeState({ sheep: { 0: { fedAt, multiplier: 1 } } }), { type: "sheep.feed", index: 0 }, NOW);
    expect(result.sheep[0].fedAt).toBe(NOW);
  });
});

// ============================================================================
// Animal produce collection
// ============================================================================

describe("serverCollectEgg", () => {
  it("collects egg when time has elapsed and resets chicken", () => {
    const fedAt  = NOW - ANIMALS_CONFIG.Chicken.produceTimeMs - 1000;
    const state  = makeState({ items: { ...makeState().items, Egg: new Decimal(0) }, chickens: { 0: { fedAt, multiplier: 1 } } });
    const result = serverCollectEgg(state, { type: "chicken.collectEgg", index: 0 }, NOW);
    expect(new Decimal(result.items.Egg!).toNumber()).toBeGreaterThanOrEqual(1);
    expect(result.chickens[0].fedAt).toBeUndefined();
    expect(result.skills.husbandry).toBeGreaterThan(0);
  });

  it("throws when chicken has not been fed", () => {
    expect(() => serverCollectEgg(makeState({ chickens: {} }), { type: "chicken.collectEgg", index: 0 }, NOW))
      .toThrow("Chicken has not been fed");
  });

  it("throws when egg is not ready yet", () => {
    const state = makeState({ chickens: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverCollectEgg(state, { type: "chicken.collectEgg", index: 0 }, NOW))
      .toThrow("Egg is not ready yet");
  });

  it("throws when chicken index is out of range", () => {
    const fedAt = NOW - ANIMALS_CONFIG.Chicken.produceTimeMs - 1000;
    const state = makeState({ chickens: { 0: { fedAt, multiplier: 1 } } });
    expect(() => serverCollectEgg(state, { type: "chicken.collectEgg", index: 5 }, NOW))
      .toThrow("Chicken does not exist");
  });
});

describe("serverCollectMilk", () => {
  it("collects milk when time has elapsed and resets cow", () => {
    const fedAt  = NOW - ANIMALS_CONFIG.Cow.produceTimeMs - 1000;
    const state  = makeState({ items: { ...makeState().items, Milk: new Decimal(0) }, cows: { 0: { fedAt, multiplier: 1 } } });
    const result = serverCollectMilk(state, { type: "cow.collectMilk", index: 0 }, NOW);
    expect(new Decimal(result.items.Milk!).toNumber()).toBeGreaterThanOrEqual(1);
    expect(result.cows[0].fedAt).toBeUndefined();
    expect(result.skills.husbandry).toBeGreaterThan(0);
  });

  it("throws when milk is not ready yet", () => {
    const state = makeState({ cows: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverCollectMilk(state, { type: "cow.collectMilk", index: 0 }, NOW)).toThrow("Milk is not ready yet");
  });

  it("throws when cow has not been fed", () => {
    expect(() => serverCollectMilk(makeState(), { type: "cow.collectMilk", index: 0 }, NOW)).toThrow("Cow has not been fed");
  });

  it("throws when cow index is out of range", () => {
    const fedAt = NOW - ANIMALS_CONFIG.Cow.produceTimeMs - 1000;
    const state = makeState({ cows: { 0: { fedAt, multiplier: 1 } } });
    expect(() => serverCollectMilk(state, { type: "cow.collectMilk", index: 3 }, NOW)).toThrow("Cow does not exist");
  });
});

describe("serverCollectWool", () => {
  it("collects wool when time has elapsed and resets sheep", () => {
    const fedAt  = NOW - ANIMALS_CONFIG.Sheep.produceTimeMs - 1000;
    const state  = makeState({ items: { ...makeState().items, Wool: new Decimal(0) }, sheep: { 0: { fedAt, multiplier: 1 } } });
    const result = serverCollectWool(state, { type: "sheep.collectWool", index: 0 }, NOW);
    expect(new Decimal(result.items.Wool!).toNumber()).toBeGreaterThanOrEqual(1);
    expect(result.sheep[0].fedAt).toBeUndefined();
    expect(result.skills.husbandry).toBeGreaterThan(0);
  });

  it("throws when wool is not ready yet", () => {
    const state = makeState({ sheep: { 0: { fedAt: NOW - 1000, multiplier: 1 } } });
    expect(() => serverCollectWool(state, { type: "sheep.collectWool", index: 0 }, NOW)).toThrow("Wool is not ready yet");
  });

  it("throws when sheep has not been fed", () => {
    expect(() => serverCollectWool(makeState(), { type: "sheep.collectWool", index: 0 }, NOW)).toThrow("Sheep has not been fed");
  });
});

// ============================================================================
// Fishing
// ============================================================================

describe("serverCatchFish", () => {
  const castAt = NOW - FISHING_BASE_COOLDOWN_MS - 1000;

  it("catches a fish when off cooldown", () => {
    const result = serverCatchFish(makeState({ fishing: { lastCastAt: castAt, lastCaughtFish: null } }), { type: "fish.caught", createdAt: NOW });
    expect(result.fishing.lastCastAt).toBe(NOW);
    expect(result.fishing.lastCaughtFish).not.toBeNull();
    expect(result.skills.fishing).toBeGreaterThan(0);
  });

  it("throws when fishing is still on cooldown", () => {
    const state = makeState({ fishing: { lastCastAt: NOW - 5000, lastCaughtFish: null } });
    expect(() => serverCatchFish(state, { type: "fish.caught", createdAt: NOW })).toThrow("Fishing is on cooldown");
  });

  it("only catches low-level fish at fishing level 1", () => {
    const result = serverCatchFish(makeState({ fishing: { lastCastAt: castAt, lastCaughtFish: null } }), { type: "fish.caught", createdAt: NOW });
    expect(["Anchovy", "Sardine", "Tilapia", "Herring"]).toContain(result.fishing.lastCaughtFish);
  });
});

// ============================================================================
// Cooking (instant)
// ============================================================================

describe("serverCookFood", () => {
  it("cooks Roasted Potato instantly and deducts ingredients", () => {
    const result = serverCookFood(makeState(), { type: "food.cook", food: "Roasted Potato" }, NOW);
    expect(new Decimal(result.items["Roasted Potato"]!).toNumber()).toBeGreaterThanOrEqual(1);
    expect(new Decimal(result.items.Potato!).toNumber()).toBeLessThan(10);
  });

  it("throws with an unknown food item", () => {
    expect(() => serverCookFood(makeState(), { type: "food.cook", food: "Mystery Dish" as never }, NOW))
      .toThrow("Unknown food");
  });

  it("throws when ingredients are insufficient", () => {
    const state = makeState({ items: { ...makeState().items, Potato: new Decimal(0) } });
    expect(() => serverCookFood(state, { type: "food.cook", food: "Roasted Potato" }, NOW))
      .toThrow("Not enough");
  });

  it("throws when amount is not a positive integer", () => {
    expect(() => serverCookFood(makeState(), { type: "food.cook", food: "Roasted Potato", amount: 0 }, NOW))
      .toThrow("positive integer");
  });
});

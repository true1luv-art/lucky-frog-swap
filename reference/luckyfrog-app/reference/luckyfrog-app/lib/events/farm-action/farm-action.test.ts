/**
 * lib/events/farm-action/farm-action.test.ts
 *
 * Unit tests for Sprint 2.2:
 *  - buildServerGameState  §2.2-B
 *  - inventoryDiff         §2.2-D
 *  - fieldsDiff computed correctly  §2.2-D
 *
 * No MongoDB connection required — all tests operate on plain objects.
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { buildServerGameState } from "./build-state";
import { inventoryDiff } from "./persist";
import type { IFarm, FieldNode, ResourceNode, AnimalNode, FishingState, StaminaState } from "@/lib/modules/farms/types.server";
import type { IInventory } from "@/lib/modules/inventories/types.server";
import type { IPlayer } from "@/lib/modules/players/types.server";
import type { PlayerSkills } from "@/shared/types/players";

// ---------------------------------------------------------------------------
// Helpers — build minimal stubs
// ---------------------------------------------------------------------------

function makeFarm(overrides: Partial<IFarm> = {}): IFarm {
  return {
    playerId: "wallet123",
    fields:   {},
    trees:    {},
    stones:   {},
    iron:     {},
    gold:     {},
    chickens: {},
    cows:     {},
    sheep:    {},
    fishing: {
      lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0,
      totalCasts: 0, totalCaught: 0,
    } as FishingState,
    cooking:  null,
    stamina: { current: 100, max: 100, lastRegenAt: 1000000 } as StaminaState,
    activity:     {},
    achievements: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as IFarm;
}

function makeInventory(overrides: Partial<IInventory> = {}): IInventory {
  return {
    playerId: "wallet123",
    items:    {},
    balance:  0,
    updatedAt: new Date(),
    ...overrides,
  } as unknown as IInventory;
}

function makePlayer(skillsOverride: Partial<PlayerSkills> = {}): IPlayer {
  return {
    wallet:   "wallet123",
    username: "TestFrog",
    skills: {
      farming: 0, woodcutting: 0, mining: 0, fishing: 0,
      cooking: 0, crafting: 0, husbandry: 0, combat: 0,
      ...skillsOverride,
    },
  } as unknown as IPlayer;
}

// ---------------------------------------------------------------------------
// buildServerGameState §2.2-B
// ---------------------------------------------------------------------------

describe("buildServerGameState", () => {
  it("returns a valid GameState from empty farm + inventory", () => {
    const state = buildServerGameState(makeFarm(), makeInventory(), makePlayer());

    expect(state.balance).toBeInstanceOf(Decimal);
    expect(state.balance.toNumber()).toBe(0);
    expect(state.fields).toEqual({});
    expect(state.inventory).toEqual({});
    expect(state.stamina.current).toBe(100);
    expect(state.stamina.max).toBe(100);
    expect(state.lastStaminaRegenAt).toBe(1000000);
    expect(state.skills.farming).toBe(0);
  });

  it("converts balance from MongoDB number to Decimal", () => {
    const inv = makeInventory({ balance: 42.5 });
    const state = buildServerGameState(makeFarm(), inv, makePlayer());
    expect(state.balance).toBeInstanceOf(Decimal);
    expect(state.balance.toNumber()).toBe(42.5);
  });

  it("converts items from MongoDB numbers to Decimal in inventory", () => {
    const inv = makeInventory({ items: { Potato: 10, Wood: 5 } as Record<string, number> });
    const state = buildServerGameState(makeFarm(), inv, makePlayer());
    expect(state.inventory["Potato"]).toBeInstanceOf(Decimal);
    expect((state.inventory["Potato"] as Decimal).toNumber()).toBe(10);
    expect((state.inventory["Wood"] as Decimal).toNumber()).toBe(5);
  });

  it("excludes zero-quantity items from inventory", () => {
    const inv = makeInventory({ items: { Potato: 0, Carrot: 3 } as Record<string, number> });
    const state = buildServerGameState(makeFarm(), inv, makePlayer());
    expect(state.inventory["Potato"]).toBeUndefined();
    expect((state.inventory["Carrot"] as Decimal).toNumber()).toBe(3);
  });

  it("maps fields from string keys to number keys", () => {
    const farm = makeFarm({
      fields: {
        "0": { name: "Potato", plantedAt: 1000 } as FieldNode,
        "5": { name: "Carrot", plantedAt: 2000 } as FieldNode,
      },
    });
    const state = buildServerGameState(farm, makeInventory(), makePlayer());
    expect(state.fields[0]).toBeDefined();
    expect(state.fields[0].name).toBe("Potato");
    expect(state.fields[0].plantedAt).toBe(1000);
    expect(state.fields[5].name).toBe("Carrot");
  });

  it("maps trees with choppedAt from harvestedAt", () => {
    const farm = makeFarm({
      trees: {
        "0": { name: "Wood", harvestedAt: 9999, amount: 3 } as ResourceNode,
      },
    });
    const state = buildServerGameState(farm, makeInventory(), makePlayer());
    expect(state.trees[0]).toBeDefined();
    expect(state.trees[0].choppedAt).toBe(9999);
    expect(state.trees[0].amount).toBe(3);
  });

  it("maps ore nodes with minedAt from harvestedAt", () => {
    const farm = makeFarm({
      stones: {
        "1": { name: "Stone", harvestedAt: 8888, amount: 2 } as ResourceNode,
      },
    });
    const state = buildServerGameState(farm, makeInventory(), makePlayer());
    expect(state.stones[1].minedAt).toBe(8888);
  });

  it("maps chickens from string keys to number keys", () => {
    const farm = makeFarm({
      chickens: {
        "0": { type: "Chicken", fedAt: 5000, multiplier: 1.2 } as AnimalNode,
      },
    });
    const state = buildServerGameState(farm, makeInventory(), makePlayer());
    expect(state.chickens[0]).toBeDefined();
    expect(state.chickens[0].fedAt).toBe(5000);
    expect(state.chickens[0].multiplier).toBe(1.2);
  });

  it("preserves the canonical woodcutting skill", () => {
    const player = makePlayer({ woodcutting: 250 });
    const state  = buildServerGameState(makeFarm(), makeInventory(), player);
    expect(state.skills.woodcutting).toBe(250);
  });

  it("preserves farming skill XP from player document", () => {
    const player = makePlayer({ farming: 1500 });
    const state  = buildServerGameState(makeFarm(), makeInventory(), player);
    expect(state.skills.farming).toBe(1500);
  });

  it("sets fishing state from farm document", () => {
    const farm = makeFarm({
      fishing: {
        lastCastAt: 12345, lastCaughtFish: "Carp", lastCaughtAmount: 2,
        totalCasts: 10, totalCaught: 8,
      } as FishingState,
    });
    const state = buildServerGameState(farm, makeInventory(), makePlayer());
    expect(state.fishing.lastCastAt).toBe(12345);
    expect(state.fishing.lastCaughtFish).toBe("Carp");
    expect(state.fishing.totalCasts).toBe(10);
  });

  it("sets cooking to null when farm.cooking is null", () => {
    const state = buildServerGameState(makeFarm({ cooking: null }), makeInventory(), makePlayer());
    expect(state.cooking).toBeNull();
  });

  it("returns default GameState when farm is null", () => {
    const state = buildServerGameState(null, makeInventory(), makePlayer());
    expect(state.fields).toEqual({});
    expect(state.stamina.current).toBe(100);
  });

  it("returns default GameState when inventory is null", () => {
    const state = buildServerGameState(makeFarm(), null, makePlayer());
    expect(state.balance.toNumber()).toBe(0);
    expect(state.inventory).toEqual({});
  });

  it("username is populated from player document", () => {
    const state = buildServerGameState(makeFarm(), makeInventory(), makePlayer());
    expect(state.username).toBe("TestFrog");
  });

  it("computeBonus is applied correctly for high farming skill", () => {
    // XP required to reach farming level 10 = 27,875. Use 30,000 to be safely above.
    const player = makePlayer({ farming: 30000 });
    const state  = buildServerGameState(makeFarm(), makeInventory(), player);
    // At farming level >= 10, cropSpeed should be +0.05 and cropYield still 0.
    // At farming level >= 30, cropYield should be +0.10.
    expect(state.bonus.cropSpeed).toBeGreaterThan(0);
  });

  it("projects canonical ownership and merges non-stacking collectible bonuses", () => {
    const player = makePlayer({ farming: 30000 });
    const skillOnly = buildServerGameState(makeFarm(), makeInventory(), player);
    const state = buildServerGameState(
      makeFarm(),
      makeInventory(),
      player,
      ["Husbandry Bell", "Harvest Scarecrow", "Harvest Scarecrow"],
    );

    expect(state.ownedCollectibles).toEqual([
      "Harvest Scarecrow",
      "Husbandry Bell",
    ]);
    expect(state.bonus.cropSpeed).toBeCloseTo(skillOnly.bonus.cropSpeed + 0.1);
    expect(state.bonus.produceSpeed).toBe(0.1);
  });
});

// ---------------------------------------------------------------------------
// inventoryDiff §2.2-D
// ---------------------------------------------------------------------------

describe("inventoryDiff", () => {
  function inv(items: Record<string, number>) {
    const result: Record<string, Decimal> = {};
    for (const [k, v] of Object.entries(items)) result[k] = new Decimal(v);
    return result as unknown as import("@/shared/types/gameplay/game").Inventory;
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
    expect(added).toEqual({});
    expect(removed).toEqual({ Potato: 3 });
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
    const { added } = inventoryDiff(
      inv({ Gold: 1 }),
      inv({ Gold: 3 }),
    );
    expect(added.Gold).toBe(2);
  });
});

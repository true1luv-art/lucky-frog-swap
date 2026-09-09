import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { craft, getBuyPrice } from "./craft";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

// "Potato Seed" is craftable with no ingredients and a price of $0.20
const SEED_ITEM = "Potato Seed" as const;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(100),
    inventory: {},
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      {},
    sheep:     {},
    fishing:   { lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
    cooking:   null,
    stamina:   { current: 100, max: 100 },
    lastStaminaRegenAt: 0,
    skills:    { farming: 0, woodcutting: 0, forestry: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
    bonus:     { ...INITIAL_BONUS },
    activity:  {},
    achievements: {},
    ...overrides,
  } as unknown as GameState;
}

describe("getBuyPrice", () => {
  it("returns 0 when item has no price", () => {
    expect(getBuyPrice({}, null).toNumber()).toBe(0);
  });

  it("returns the item price", () => {
    expect(getBuyPrice({ price: new Decimal(5) }, null).toNumber()).toBe(5);
  });
});

describe("craft", () => {
  it("throws when item is not craftable", () => {
    const state = makeState();
    expect(() => craft({ state, action: { type: "item.crafted", item: "Unknown Item" as never, amount: 1 } })).toThrow("not craftable");
  });

  it("throws when amount is less than 1", () => {
    const state = makeState();
    expect(() => craft({ state, action: { type: "item.crafted", item: SEED_ITEM, amount: 0 } })).toThrow("Invalid amount");
  });

  it("throws when insufficient balance", () => {
    const state = makeState({ balance: new Decimal(0) });
    expect(() => craft({ state, action: { type: "item.crafted", item: SEED_ITEM, amount: 1 } })).toThrow("Insufficient tokens");
  });

  it("deducts balance and adds item to inventory on success", () => {
    const state  = makeState();
    const result = craft({ state, action: { type: "item.crafted", item: SEED_ITEM, amount: 1 } });
    expect(new Decimal(result.balance).lessThan(state.balance)).toBe(true);
    expect(new Decimal(result.inventory[SEED_ITEM]!).toNumber()).toBe(1);
  });

  it("crafts multiple items at once", () => {
    const state  = makeState();
    const result = craft({ state, action: { type: "item.crafted", item: SEED_ITEM, amount: 5 } });
    expect(new Decimal(result.inventory[SEED_ITEM]!).toNumber()).toBe(5);
  });
});

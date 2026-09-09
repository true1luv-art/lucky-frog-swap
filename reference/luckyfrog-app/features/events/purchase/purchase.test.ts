import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { purchase } from "./purchase";
import { SEEDS } from "@/features/types/gameplay/crops";
import { CRAFTABLES } from "@/features/types/gameplay/craftables";
import type { GameState } from "@/features/types/gameplay/game";

const SEED = Object.keys(SEEDS())[0] as keyof ReturnType<typeof SEEDS>;
const SEED_PRICE: Decimal = CRAFTABLES()[SEED]?.price ?? new Decimal(0);

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(1000),
    items: {},
    fields:    {},
    trees:     {},
    stones:    {},
    iron:      {},
    gold:      {},
    chickens:  {},
    cows:      {},
    sheep:     {},
    fishing:   { lastCastAt: 0, lastCaughtFish: null },
    cooking:   null,
    stamina:   { current: 100, max: 100 },
    lastStaminaRegenAt: 0,
    skills:    { farming: 0, woodcutting: 0, forestry: 0, mining: 0, fishing: 0, cooking: 0, crafting: 0, husbandry: 0, combat: 0 },
    milestones: {},
    ...overrides,
  } as unknown as GameState;
}

describe("purchase", () => {
  it("deducts balance and adds seed to inventory", () => {
    const state  = makeState();
    const result = purchase({ state, action: { type: "item.crafted", item: SEED, amount: 1 } });
    expect(new Decimal(result.items[SEED]!).toNumber()).toBe(1);
    expect(new Decimal(result.balance).lessThan(state.balance)).toBe(true);
  });

  it("deducts the correct total for multiple units", () => {
    const state    = makeState();
    const result   = purchase({ state, action: { type: "item.crafted", item: SEED, amount: 3 } });
    const expected = new Decimal(1000).sub(SEED_PRICE.mul(3));
    expect(new Decimal(result.balance).toNumber()).toBeCloseTo(expected.toNumber(), 4);
  });

  it("throws when balance is insufficient", () => {
    const state = makeState({ balance: new Decimal(0) });
    expect(() =>
      purchase({ state, action: { type: "item.crafted", item: SEED, amount: 1 } }),
    ).toThrow("Insufficient tokens");
  });

  it("throws when item is not purchasable", () => {
    const state = makeState();
    expect(() =>
      purchase({ state, action: { type: "item.crafted", item: "Wood" as never, amount: 1 } }),
    ).toThrow("not purchasable");
  });

  it("throws when amount is less than 1", () => {
    const state = makeState();
    expect(() =>
      purchase({ state, action: { type: "item.crafted", item: SEED, amount: 0 } }),
    ).toThrow("Invalid amount");
  });
});

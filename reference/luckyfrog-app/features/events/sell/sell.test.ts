import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { sell } from "./sell";
import type { GameState } from "@/features/types/gameplay/game";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(100),
    items: { Potato: new Decimal(5) },
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

describe("sell", () => {
  it("increases balance and decreases inventory when selling a crop", () => {
    const state  = makeState();
    const result = sell({ state, action: { type: "item.sell", item: "Potato", amount: 2 } });
    expect(new Decimal(result.balance).greaterThan(state.balance)).toBe(true);
    expect(new Decimal(result.items["Potato"]!).toNumber()).toBe(3);
  });

  it("throws when item is not a crop", () => {
    const state = makeState({ items: { Wood: new Decimal(5) } });
    expect(() => sell({ state, action: { type: "item.sell", item: "Wood", amount: 1 } })).toThrow("Not for sale");
  });

  it("throws when amount is zero or negative", () => {
    const state = makeState();
    expect(() => sell({ state, action: { type: "item.sell", item: "Potato", amount: 0 } })).toThrow("Invalid amount");
    expect(() => sell({ state, action: { type: "item.sell", item: "Potato", amount: -1 } })).toThrow("Invalid amount");
  });

  it("throws when insufficient crops", () => {
    const state = makeState({ items: { Potato: new Decimal(1) } });
    expect(() => sell({ state, action: { type: "item.sell", item: "Potato", amount: 5 } })).toThrow("Insufficient crops to sell");
  });

  it("tracks Coins Earned milestone", () => {
    const state  = makeState();
    const result = sell({ state, action: { type: "item.sell", item: "Potato", amount: 1 } });
    expect(result.milestones["Coins Earned"]).toBeGreaterThan(0);
  });
});

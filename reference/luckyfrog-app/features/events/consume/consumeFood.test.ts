import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { consumeFood } from "./consumeFood";
import { FOODS } from "@/features/types/gameplay/craftables";
import type { GameState } from "@/features/types/gameplay/game";

const FOOD = Object.keys(FOODS())[0] as keyof ReturnType<typeof FOODS>;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(100),
    items: { [FOOD]: new Decimal(3) },
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
    fishing:   { lastCastAt: 0, lastCaughtFish: null },
    cooking:   null,
    skills:    {
      farming: 0, woodcutting: 0, mining: 0, fishing: 0,
      husbandry: 0, combat: 0, cooking: 0, smithing: 0,
    },
    milestones: {},
    ...overrides,
  } as unknown as GameState;
}

describe("consumeFood", () => {
  it("deducts food from inventory when eaten", () => {
    const state  = makeState();
    const result = consumeFood({ state, action: { type: "food.consume", item: FOOD, amount: 1 } });
    expect(new Decimal(result.items[FOOD]!).toNumber()).toBe(2);
  });

  it("throws when item is not a food", () => {
    const state = makeState({ items: { Wood: new Decimal(5) } });
    expect(() =>
      consumeFood({ state, action: { type: "food.consume", item: "Wood" as never, amount: 1 } }),
    ).toThrow("Not a food item");
  });

  it("throws when amount is zero or negative", () => {
    const state = makeState();
    expect(() =>
      consumeFood({ state, action: { type: "food.consume", item: FOOD, amount: 0 } }),
    ).toThrow("Invalid amount");
  });

  it("throws when not enough food in inventory", () => {
    const state = makeState({ items: { [FOOD]: new Decimal(1) } });
    expect(() =>
      consumeFood({ state, action: { type: "food.consume", item: FOOD, amount: 5 } }),
    ).toThrow("Insufficient food to eat");
  });
});

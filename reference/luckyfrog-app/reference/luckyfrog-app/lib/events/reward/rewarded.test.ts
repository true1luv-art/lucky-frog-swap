import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { openReward } from "./rewarded";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { CROPS } from "@/shared/types/gameplay/crops";

const POTATO_SECONDS = CROPS()["Potato"].harvestSeconds;
const READY_AT       = POTATO_SECONDS * 1000 + 1;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    inventory: {},
    fields:    {
      0: {
        name:      "Potato",
        plantedAt: 0,
        amount:    1,
        reward:    { items: [{ name: "Potato Seed", amount: 1 }] },
      },
    },
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

describe("openReward", () => {
  it("throws when field does not exist", () => {
    const state = makeState({ fields: {} });
    expect(() => openReward({ state, action: { type: "reward.opened", fieldIndex: 0 }, createdAt: READY_AT })).toThrow("Field does not exist");
  });

  it("throws when field has no reward", () => {
    const state = makeState({ fields: { 0: { name: "Potato", plantedAt: 0, amount: 1 } } });
    expect(() => openReward({ state, action: { type: "reward.opened", fieldIndex: 0 }, createdAt: READY_AT })).toThrow("Field does not have a reward");
  });

  it("throws when crop is not ready", () => {
    const state = makeState({
      fields: {
        0: { name: "Potato", plantedAt: READY_AT, amount: 1, reward: { items: [{ name: "Potato Seed", amount: 1 }] } },
      },
    });
    expect(() => openReward({ state, action: { type: "reward.opened", fieldIndex: 0 }, createdAt: READY_AT + 1 })).toThrow("Not ready");
  });

  it("adds reward item to inventory and removes reward from field", () => {
    const state  = makeState();
    const result = openReward({ state, action: { type: "reward.opened", fieldIndex: 0 }, createdAt: READY_AT });
    expect(new Decimal(result.inventory["Potato Seed"]!).toNumber()).toBe(1);
    expect(result.fields[0]?.reward).toBeUndefined();
  });
});

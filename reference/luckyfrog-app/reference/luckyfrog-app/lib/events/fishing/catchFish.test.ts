import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { catchFish } from "./catchFish";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { FISHING_BASE_COOLDOWN_MS } from "@/shared/game/constants";

const NOW         = 1_000_000_000;
const AFTER_COOLDOWN = NOW + FISHING_BASE_COOLDOWN_MS + 1;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
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

describe("catchFish", () => {
  it("throws when not enough stamina", () => {
    const state = makeState({ stamina: { current: 0, max: 100 } });
    expect(() => catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } })).toThrow("Not enough stamina to fish");
  });

  it("throws when fishing is on cooldown", () => {
    const state = makeState({ fishing: { lastCastAt: NOW, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 1, totalCaught: 0 } });
    expect(() => catchFish({ state, action: { type: "fish.caught", createdAt: NOW + 1 } })).toThrow("Fishing is on cooldown");
  });

  it("adds a caught fish to inventory on success", () => {
    const state  = makeState();
    const result = catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } });
    const fishInInventory = Object.values(result.inventory).some((v) => new Decimal(v ?? 0).toNumber() > 0);
    expect(fishInInventory).toBe(true);
  });

  it("updates fishing state on success", () => {
    const state  = makeState();
    const result = catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } });
    expect(result.fishing.lastCastAt).toBe(AFTER_COOLDOWN);
    expect(result.fishing.totalCasts).toBe(1);
    expect(result.fishing.totalCaught).toBe(1);
  });

  it("awards fishing XP and deducts stamina", () => {
    const state  = makeState();
    const result = catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } });
    expect(result.skills.fishing).toBeGreaterThan(0);
    expect(result.stamina.current).toBeLessThan(100);
  });

  it("stores the effective cooldown when a cast is created", () => {
    const state = makeState({
      bonus: { ...INITIAL_BONUS, fishSpeed: 0.1 },
      ownedCollectibles: ["Fisher's Shrine"],
    });
    const result = catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } });
    expect(result.fishing.cooldownMs).toBe(FISHING_BASE_COOLDOWN_MS * 0.9);
  });

  it("uses the previous cast snapshot after the current bonus changes", () => {
    const state = makeState({
      bonus: { ...INITIAL_BONUS },
      fishing: {
        lastCastAt: NOW,
        cooldownMs: FISHING_BASE_COOLDOWN_MS * 0.9,
        lastCaughtFish: null,
        lastCaughtAmount: 0,
        totalCasts: 1,
        totalCaught: 1,
      },
    });
    expect(() => catchFish({
      state,
      action: { type: "fish.caught", createdAt: NOW + FISHING_BASE_COOLDOWN_MS * 0.9 },
    })).not.toThrow();
  });
});

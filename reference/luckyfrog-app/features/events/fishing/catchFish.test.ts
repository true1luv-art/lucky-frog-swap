import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { catchFish } from "./catchFish";
import type { GameState } from "@/features/types/gameplay/game";
import { FISHING_ACTION_MS } from "@/features/game/fishing";

const NOW            = 1_000_000_000;
const AFTER_COOLDOWN = NOW + FISHING_ACTION_MS + 1;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    balance:   new Decimal(0),
    items: { Rod: new Decimal(10) },
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

describe("catchFish", () => {
  it("throws when out of rods", () => {
    const state = makeState({ items: { Rod: new Decimal(0) } });
    expect(() => catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } })).toThrow("No rods left");
  });

  it("deducts a rod per cast", () => {
    const state  = makeState();
    const result = catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } });
    expect(new Decimal(result.items["Rod"] ?? 0).toNumber()).toBe(9);
  });

  it("throws when fishing is on cooldown", () => {
    const state = makeState({ fishing: { lastCastAt: NOW, lastCaughtFish: null } });
    expect(() => catchFish({ state, action: { type: "fish.caught", createdAt: NOW + 1 } })).toThrow("Fishing is on cooldown");
  });

  it("adds a caught fish to inventory on success", () => {
    const state  = makeState();
    const result = catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } });
    const fishInInventory = Object.entries(result.items).some(
      ([name, v]) => name !== "Rod" && new Decimal(v ?? 0).toNumber() > 0,
    );
    expect(fishInInventory).toBe(true);
  });

  it("updates lastCastAt and lastCaughtFish on success", () => {
    const state  = makeState();
    const result = catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } });
    expect(result.fishing.lastCastAt).toBe(AFTER_COOLDOWN);
    expect(result.fishing.lastCaughtFish).not.toBeNull();
  });

  it("awards fishing XP", () => {
    const state  = makeState();
    const result = catchFish({ state, action: { type: "fish.caught", createdAt: AFTER_COOLDOWN } });
    expect(result.skills.fishing).toBeGreaterThan(0);
  });

  it("allows a cast exactly after the base cooldown elapses", () => {
    const state = makeState({ fishing: { lastCastAt: NOW, lastCaughtFish: null } });
    expect(() => catchFish({
      state,
      action: { type: "fish.caught", createdAt: NOW + FISHING_ACTION_MS + 1 },
    })).not.toThrow();
  });
});

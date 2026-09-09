/**
 * features/events/hero-stamina-regen/action.test.ts
 */

import { describe, it, expect } from "vitest";
import { heroStaminaRegen } from "./action";
import type { StaminaRegenState } from "./action";
import type { RosterHero } from "@/features/store/gameStore";
import {
  RECOVERY_FRACTION_PER_INTERVAL,
  RECOVERY_INTERVAL_SECONDS,
} from "@/features/store/gameStore";
import { HeroRarity, HeroType } from "@/features/types/HeroRarity";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHero(overrides: Partial<RosterHero> = {}): RosterHero {
  return {
    id:            "hero-1",
    name:          "Digger",
    minted_number: 1,
    description:   "",
    image:         null,
    owner:         "wallet-a",
    level:         1,
    rarity:        HeroRarity.Common,
    attributes:    { power: 1, speed: 1, stamina: 5, bomb_number: 1, bomb_range: 1 },
    market:        { listed: false, price: 0, seller: null, created: 0, sold: 0 },
    type:          HeroType.BlazeBomber,
    rarityLabel:   "Common",
    currentEnergy: 0,
    maxEnergy:     500,
    onMap:         false,
    ...overrides,
  };
}

function makeState(heroes: RosterHero[]): StaminaRegenState {
  return { heroes };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("heroStaminaRegen", () => {
  it("rejects a zero deltaSec", () => {
    const result = heroStaminaRegen({ state: makeState([makeHero()]), action: { deltaSec: 0 } });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_DELTA");
  });

  it("rejects a negative deltaSec", () => {
    const result = heroStaminaRegen({ state: makeState([makeHero()]), action: { deltaSec: -10 } });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_DELTA");
  });

  it("recovers energy for a resting hero proportional to deltaSec", () => {
    const hero = makeHero({ currentEnergy: 0, maxEnergy: 500, onMap: false });
    const deltaSec = RECOVERY_INTERVAL_SECONDS; // one full interval
    const result = heroStaminaRegen({ state: makeState([hero]), action: { deltaSec } });

    expect(result.ok).toBe(true);
    const expected = 500 * RECOVERY_FRACTION_PER_INTERVAL; // 50
    expect(result.roster![0].currentEnergy).toBeCloseTo(expected, 5);
  });

  it("caps energy at maxEnergy", () => {
    const hero = makeHero({ currentEnergy: 490, maxEnergy: 500, onMap: false });
    // deltaSec large enough that gain would exceed max
    const deltaSec = RECOVERY_INTERVAL_SECONDS * 10;
    const result = heroStaminaRegen({ state: makeState([hero]), action: { deltaSec } });
    expect(result.roster![0].currentEnergy).toBe(500);
  });

  it("skips heroes that are already at max energy", () => {
    const hero = makeHero({ currentEnergy: 500, maxEnergy: 500, onMap: false });
    const result = heroStaminaRegen({ state: makeState([hero]), action: { deltaSec: 300 } });
    expect(result.updatedCount).toBe(0);
    expect(result.roster![0].currentEnergy).toBe(500);
  });

  it("skips deployed heroes (onMap === true)", () => {
    const hero = makeHero({ currentEnergy: 0, maxEnergy: 500, onMap: true });
    const result = heroStaminaRegen({ state: makeState([hero]), action: { deltaSec: 300 } });
    expect(result.updatedCount).toBe(0);
    expect(result.roster![0].currentEnergy).toBe(0);
  });

  it("only updates resting heroes when roster is mixed", () => {
    const resting   = makeHero({ id: "r", currentEnergy: 0,   onMap: false });
    const deployed  = makeHero({ id: "d", currentEnergy: 100, onMap: true  });
    const full      = makeHero({ id: "f", currentEnergy: 500, onMap: false });

    const result = heroStaminaRegen({
      state:  makeState([resting, deployed, full]),
      action: { deltaSec: RECOVERY_INTERVAL_SECONDS },
    });

    expect(result.updatedCount).toBe(1);
    const r = result.roster!.find((h) => h.id === "r")!;
    const d = result.roster!.find((h) => h.id === "d")!;
    const f = result.roster!.find((h) => h.id === "f")!;
    expect(r.currentEnergy).toBeGreaterThan(0);
    expect(d.currentEnergy).toBe(100); // unchanged
    expect(f.currentEnergy).toBe(500); // unchanged
  });

  it("does not mutate the original roster", () => {
    const hero = makeHero({ currentEnergy: 0 });
    const state = makeState([hero]);
    heroStaminaRegen({ state, action: { deltaSec: 300 } });
    expect(state.heroes[0].currentEnergy).toBe(0);
  });
});

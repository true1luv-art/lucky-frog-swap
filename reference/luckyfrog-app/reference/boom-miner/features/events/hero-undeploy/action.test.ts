/**
 * features/events/hero-undeploy/action.test.ts
 */

import { describe, it, expect } from "vitest";
import { heroUndeploy } from "./action";
import type { UndeployState } from "./action";
import type { RosterHero } from "@/features/store/gameStore";
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
    onMap:         true,
    ...overrides,
  };
}

function makeState(heroes: RosterHero[]): UndeployState {
  return { wallet: "wallet-a", heroes };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("heroUndeploy", () => {
  it("recalls a deployed hero", () => {
    const hero = makeHero({ onMap: true });
    const result = heroUndeploy({ state: makeState([hero]), action: { heroId: "hero-1" } });
    expect(result.ok).toBe(true);
    expect(result.hero?.onMap).toBe(false);
    expect(result.roster?.find((h) => h.id === "hero-1")?.onMap).toBe(false);
  });

  it("allows recall even when energy is zero", () => {
    const hero = makeHero({ onMap: true, currentEnergy: 0 });
    const result = heroUndeploy({ state: makeState([hero]), action: { heroId: "hero-1" } });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown heroId", () => {
    const result = heroUndeploy({ state: makeState([makeHero()]), action: { heroId: "hero-99" } });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("HERO_NOT_FOUND");
  });

  it("rejects a hero that does not belong to the wallet", () => {
    const hero = makeHero({ owner: "wallet-b" });
    const result = heroUndeploy({ state: makeState([hero]), action: { heroId: "hero-1" } });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NOT_OWNER");
  });

  it("rejects a hero that is not deployed", () => {
    const hero = makeHero({ onMap: false });
    const result = heroUndeploy({ state: makeState([hero]), action: { heroId: "hero-1" } });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NOT_DEPLOYED");
  });

  it("does not mutate the original roster", () => {
    const hero = makeHero({ onMap: true });
    const state = makeState([hero]);
    heroUndeploy({ state, action: { heroId: "hero-1" } });
    expect(state.heroes[0].onMap).toBe(true);
  });
});

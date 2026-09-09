/**
 * features/events/hero-deploy/action.test.ts
 */

import { describe, it, expect } from "vitest";
import { heroDeploy } from "./action";
import type { DeployState } from "./action";
import type { RosterHero } from "@/features/store/gameStore";
import { MAX_ON_MAP } from "@/features/store/gameStore";
import { HeroRarity, HeroType } from "@/features/types/HeroRarity";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHero(overrides: Partial<RosterHero> = {}): RosterHero {
  return {
    id:           "hero-1",
    name:         "Digger",
    minted_number: 1,
    description:  "",
    image:        null,
    owner:        "wallet-a",
    level:        1,
    rarity:       HeroRarity.Common,
    attributes:   { power: 1, speed: 1, stamina: 5, bomb_number: 1, bomb_range: 1 },
    market:       { listed: false, price: 0, seller: null, created: 0, sold: 0 },
    type:         HeroType.BlazeBomber,
    rarityLabel:  "Common",
    currentEnergy: 500,
    maxEnergy:    500,
    onMap:        false,
    ...overrides,
  };
}

function makeState(heroes: RosterHero[]): DeployState {
  return { wallet: "wallet-a", heroes };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("heroDeploy", () => {
  it("deploys a ready hero", () => {
    const hero = makeHero();
    const result = heroDeploy({ state: makeState([hero]), action: { heroId: "hero-1" } });
    expect(result.ok).toBe(true);
    expect(result.hero?.onMap).toBe(true);
    expect(result.roster?.find((h) => h.id === "hero-1")?.onMap).toBe(true);
  });

  it("rejects an unknown heroId", () => {
    const result = heroDeploy({ state: makeState([makeHero()]), action: { heroId: "hero-99" } });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("HERO_NOT_FOUND");
  });

  it("rejects a hero that does not belong to the wallet", () => {
    const hero = makeHero({ owner: "wallet-b" });
    const result = heroDeploy({ state: makeState([hero]), action: { heroId: "hero-1" } });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NOT_OWNER");
  });

  it("rejects a hero already on the map", () => {
    const hero = makeHero({ onMap: true });
    const result = heroDeploy({ state: makeState([hero]), action: { heroId: "hero-1" } });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("ALREADY_DEPLOYED");
  });

  it("rejects a hero with zero energy", () => {
    const hero = makeHero({ currentEnergy: 0 });
    const result = heroDeploy({ state: makeState([hero]), action: { heroId: "hero-1" } });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INSUFFICIENT_ENERGY");
  });

  it("rejects deploy when map is at MAX_ON_MAP", () => {
    const onMapHeroes: RosterHero[] = Array.from({ length: MAX_ON_MAP }, (_, i) =>
      makeHero({ id: `hero-on-${i}`, onMap: true }),
    );
    const bench = makeHero({ id: "hero-bench", onMap: false });
    const result = heroDeploy({
      state:  makeState([...onMapHeroes, bench]),
      action: { heroId: "hero-bench" },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("MAP_FULL");
  });

  it("does not mutate the original roster", () => {
    const hero = makeHero();
    const state = makeState([hero]);
    heroDeploy({ state, action: { heroId: "hero-1" } });
    expect(state.heroes[0].onMap).toBe(false);
  });
});

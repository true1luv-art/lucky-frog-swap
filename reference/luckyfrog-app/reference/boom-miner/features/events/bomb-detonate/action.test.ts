import { describe, it, expect } from "vitest";
import { bombDetonate, MIN_DETONATE_INTERVAL_MS } from "./action";
import type { MineState } from "@/features/mine-action/types";

function baseState(overrides: Partial<MineState> = {}): MineState {
  return {
    wallet:         "wallet-1",
    coins:          1000,
    stage:          1,
    lastActionAt:   0,
    mapVersion:     0,
    totalNodes:     3,
    destroyedNodes: 0,
    heroes: {
      // power 3 hero — one blast should clear a 2-HP and 3-HP chest.
      "hero-1": { _id: "hero-1", currentEnergy: 50, maxEnergy: 100, power: 3, lastActionAt: 0 },
    },
    nodes: {
      "2,3": { kind: "chest", hp: 3, maxHp: 3, coinReward: 50, destroyed: false, x: 2, y: 3 },
      "4,4": { kind: "chest", hp: 5, maxHp: 5, coinReward: 75, destroyed: false, x: 4, y: 4 },
      "5,5": { kind: "bush",  hp: 1, maxHp: 1, coinReward: 0,  destroyed: false, x: 5, y: 5 },
    },
    ...overrides,
  };
}

const NOW = 2_000_000;
const action = (nodeKeys: string[]) => ({
  type: "bomb.detonate" as const,
  heroId: "hero-1",
  nodeKeys,
});

describe("bombDetonate", () => {
  it("applies hero.power damage to every node in the blast", () => {
    const state = baseState();
    const res = bombDetonate({ state, action: action(["2,3", "4,4"]), createdAt: NOW });
    expect(res.ok).toBe(true);
    // 3-HP chest destroyed by power 3; 5-HP chest reduced to 2.
    expect(res.newState!.nodes["2,3"].destroyed).toBe(true);
    expect(res.newState!.nodes["4,4"].hp).toBe(2);
    expect(res.newState!.nodes["4,4"].destroyed).toBe(false);
    expect(res.destroyedKeys).toEqual(["2,3"]);
    expect(res.coinsEarned).toBe(50);
  });

  it("charges exactly 1 energy per detonation regardless of tiles hit", () => {
    const state = baseState();
    const res = bombDetonate({ state, action: action(["2,3", "4,4", "5,5"]), createdAt: NOW });
    expect(res.ok).toBe(true);
    expect(res.heroEnergy).toBe(49); // 50 - 1
  });

  it("destroys a multi-HP chest in a single blast when power is enough", () => {
    // Previously this required multiple hits and the server never destroyed it.
    const state = baseState();
    const res = bombDetonate({ state, action: action(["2,3"]), createdAt: NOW });
    expect(res.newState!.nodes["2,3"].destroyed).toBe(true);
    expect(res.destroyedKeys).toContain("2,3");
  });

  it("rejects a second detonation from the SAME hero too soon", () => {
    const state = baseState({
      heroes: { "hero-1": { _id: "hero-1", currentEnergy: 50, maxEnergy: 100, power: 3, lastActionAt: NOW - 10 } },
    });
    const res = bombDetonate({ state, action: action(["2,3"]), createdAt: NOW });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("DETONATE_TOO_FAST");
  });

  it("does NOT rate-limit different heroes hitting concurrently", () => {
    const state = baseState({
      heroes: {
        "hero-1": { _id: "hero-1", currentEnergy: 50, maxEnergy: 100, power: 3, lastActionAt: NOW - 5 },
        "hero-2": { _id: "hero-2", currentEnergy: 50, maxEnergy: 100, power: 3, lastActionAt: 0 },
      },
    });
    const res = bombDetonate({
      state,
      action: { type: "bomb.detonate", heroId: "hero-2", nodeKeys: ["2,3"] },
      createdAt: NOW,
    });
    expect(res.ok).toBe(true);
  });

  it("allows a second detonation after the interval elapses", () => {
    const state = baseState({
      heroes: { "hero-1": { _id: "hero-1", currentEnergy: 50, maxEnergy: 100, power: 3, lastActionAt: NOW - MIN_DETONATE_INTERVAL_MS - 1 } },
    });
    const res = bombDetonate({ state, action: action(["2,3"]), createdAt: NOW });
    expect(res.ok).toBe(true);
  });

  it("rejects when hero has no energy", () => {
    const state = baseState({
      heroes: { "hero-1": { _id: "hero-1", currentEnergy: 0, maxEnergy: 100, power: 3, lastActionAt: 0 } },
    });
    const res = bombDetonate({ state, action: action(["2,3"]), createdAt: NOW });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("INSUFFICIENT_ENERGY");
  });

  it("rejects when the hero is not on the map", () => {
    const state = baseState();
    const res = bombDetonate({
      state,
      action: { type: "bomb.detonate", heroId: "ghost", nodeKeys: ["2,3"] },
      createdAt: NOW,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("HERO_NOT_ON_MAP");
  });

  it("silently ignores already-destroyed / missing nodes but still spends the bomb", () => {
    const state = baseState({
      nodes: {
        "2,3": { kind: "chest", hp: 0, maxHp: 3, coinReward: 50, destroyed: true, x: 2, y: 3 },
      },
      totalNodes: 1,
      destroyedNodes: 1,
    });
    const res = bombDetonate({ state, action: action(["2,3", "9,9"]), createdAt: NOW });
    expect(res.ok).toBe(true);
    expect(res.destroyedKeys).toEqual([]);
    expect(res.heroEnergy).toBe(49);
  });

  it("marks stage complete when the last node is destroyed", () => {
    const state = baseState({
      nodes: {
        "2,3": { kind: "chest", hp: 1, maxHp: 1, coinReward: 50, destroyed: false, x: 2, y: 3 },
      },
      totalNodes: 1,
      destroyedNodes: 0,
    });
    const res = bombDetonate({ state, action: action(["2,3"]), createdAt: NOW });
    expect(res.ok).toBe(true);
    expect(res.stageComplete).toBe(true);
  });
});

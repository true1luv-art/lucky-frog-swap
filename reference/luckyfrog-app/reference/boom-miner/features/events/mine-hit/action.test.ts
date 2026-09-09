/**
 * features/events/mine-hit/action.test.ts
 *
 * Pure unit tests — no DB, no network.
 */

import { describe, it, expect } from "vitest";
import { mineHit } from "./action";
import type { MineState } from "@/features/mine-action/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseState(overrides: Partial<MineState> = {}): MineState {
  return {
    wallet:         "0xTEST",
    coins:          1000,
    stage:          1,
    lastActionAt:   0,
    mapVersion:     0,
    totalNodes:     3,
    destroyedNodes: 0,
    heroes: {
      "hero-1": { _id: "hero-1", currentEnergy: 50, maxEnergy: 100, power: 1, lastActionAt: 0 },
    },
    nodes: {
      "2,3": { kind: "chest", hp: 2, maxHp: 2, coinReward: 50, destroyed: false, x: 2, y: 3 },
      "4,4": { kind: "chest", hp: 1, maxHp: 1, coinReward: 75, destroyed: false, x: 4, y: 4 },
      "5,5": { kind: "bush",  hp: 1, maxHp: 1, coinReward: 0,  destroyed: false, x: 5, y: 5 },
    },
    ...overrides,
  };
}

const NOW = 2_000_000;
const hitAction = (nodeKey = "2,3") => ({
  type: "node.hit" as const,
  heroId:  "hero-1",
  nodeKey,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mineHit", () => {
  it("rate-limit guard — returns HIT_TOO_FAST when hitting within 800 ms", () => {
    const state = baseState({ lastActionAt: NOW - 400 }); // only 400 ms ago
    const result = mineHit({ state, action: hitAction(), createdAt: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("HIT_TOO_FAST");
  });

  it("hero not on map — returns HERO_NOT_ON_MAP", () => {
    const state = baseState();
    const result = mineHit({
      state,
      action: { type: "node.hit", heroId: "hero-99", nodeKey: "2,3" },
      createdAt: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("HERO_NOT_ON_MAP");
  });

  it("hero has no energy — returns INSUFFICIENT_ENERGY", () => {
    const state = baseState({
      heroes: { "hero-1": { _id: "hero-1", currentEnergy: 0, maxEnergy: 100, power: 1, lastActionAt: 0 } },
    });
    const result = mineHit({ state, action: hitAction(), createdAt: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INSUFFICIENT_ENERGY");
  });

  it("node already destroyed — returns NODE_GONE", () => {
    const state = baseState({
      nodes: {
        ...baseState().nodes,
        "2,3": { kind: "chest", hp: 0, maxHp: 2, coinReward: 50, destroyed: true, x: 2, y: 3 },
      },
    });
    const result = mineHit({ state, action: hitAction("2,3"), createdAt: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NODE_GONE");
  });

  it("valid partial hit — decrements hp and energy, earns 0 coins, no eventType", () => {
    const state = baseState();
    const result = mineHit({ state, action: hitAction("2,3"), createdAt: NOW });
    expect(result.ok).toBe(true);
    expect(result.coinsEarned).toBe(0);
    expect(result.destroyed).toBe(false);
    expect(result.eventType).toBeUndefined();
    expect(result.newState!.nodes["2,3"].hp).toBe(1);
    expect(result.newState!.heroes["hero-1"].currentEnergy).toBe(49);
    expect(result.newState!.coins).toBe(1000);
  });

  it("valid hit destroying a chest — earns coins, eventType is chest.destroyed", () => {
    const state = baseState();
    // Node "4,4" has hp:1 so one hit destroys it
    const result = mineHit({ state, action: hitAction("4,4"), createdAt: NOW });
    expect(result.ok).toBe(true);
    expect(result.destroyed).toBe(true);
    expect(result.coinsEarned).toBe(75);
    expect(result.eventType).toBe("chest.destroyed");
    expect(result.newState!.nodes["4,4"].destroyed).toBe(true);
    expect(result.newState!.coins).toBe(1075);
  });

  it("valid hit destroying a bush — earns 0 coins, eventType is bush.destroyed", () => {
    const state = baseState();
    const result = mineHit({ state, action: hitAction("5,5"), createdAt: NOW });
    expect(result.ok).toBe(true);
    expect(result.destroyed).toBe(true);
    expect(result.coinsEarned).toBe(0);
    expect(result.eventType).toBe("bush.destroyed");
    expect(result.newState!.nodes["5,5"].destroyed).toBe(true);
    expect(result.newState!.coins).toBe(1000); // no change
  });

  it("stage complete — stageComplete true when destroyedNodes >= totalNodes", () => {
    // Start with 2 already destroyed, totalNodes = 3; one more hit finishes it
    const state = baseState({ destroyedNodes: 2, totalNodes: 3 });
    const result = mineHit({ state, action: hitAction("4,4"), createdAt: NOW });
    expect(result.ok).toBe(true);
    expect(result.stageComplete).toBe(true);
  });
});

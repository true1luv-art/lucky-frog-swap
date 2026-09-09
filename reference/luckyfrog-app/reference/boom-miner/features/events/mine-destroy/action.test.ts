/**
 * features/events/mine-destroy/action.test.ts
 *
 * Pure unit tests — no DB, no network.
 */

import { describe, it, expect } from "vitest";
import { mineDestroy } from "./action";
import type { MapNodeSnapshot } from "@/features/mine-action/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChest(coinReward = 50): MapNodeSnapshot {
  return {
    kind:      "chest",
    rarity:    undefined,
    hp:        0,
    maxHp:     3,
    coinReward,
    destroyed: false,
    x:         2,
    y:         4,
  };
}

function makeBush(): MapNodeSnapshot {
  return {
    kind:      "bush",
    hp:        0,
    maxHp:     1,
    coinReward: 0,
    destroyed: false,
    x:         5,
    y:         5,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mineDestroy", () => {
  it("chest destroyed — earns full coinReward", () => {
    const node = makeChest(75);
    const result = mineDestroy({
      node,
      action: { type: "chest.destroyed", nodeKey: "2,4" },
    });
    expect(result.eventType).toBe("chest.destroyed");
    expect(result.coinsEarned).toBe(75);
  });

  it("bush destroyed — earns 0 coins", () => {
    const node = makeBush();
    const result = mineDestroy({
      node,
      action: { type: "bush.destroyed", nodeKey: "5,5" },
    });
    expect(result.eventType).toBe("bush.destroyed");
    expect(result.coinsEarned).toBe(0);
  });

  it("rare chest destroyed — coinsEarned matches node.coinReward exactly", () => {
    const rareReward = 300;
    const node: MapNodeSnapshot = {
      ...makeChest(rareReward),
      rarity: "rare" as import("@/features/types/ChestRarity").ChestRarity,
    };
    const result = mineDestroy({
      node,
      action: { type: "chest.destroyed", nodeKey: "3,7" },
    });
    expect(result.eventType).toBe("chest.destroyed");
    expect(result.coinsEarned).toBe(rareReward);
  });
});

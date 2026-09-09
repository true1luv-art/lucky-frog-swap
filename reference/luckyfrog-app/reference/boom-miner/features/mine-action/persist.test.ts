import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MineState } from "./types";

const mocks = vi.hoisted(() => ({
  mapUpdate: vi.fn(),
  heroUpdate: vi.fn(),
  playerUpdate: vi.fn(),
  endSession: vi.fn(),
  connect: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: {
    startSession: vi.fn(async () => ({
      withTransaction: mocks.withTransaction,
      endSession: mocks.endSession,
    })),
  },
}));
vi.mock("@/lib/config/database", () => ({ connectDatabase: mocks.connect }));
vi.mock("@/lib/modules/stage-maps/model.server", () => ({
  StageMapModel: { updateOne: mocks.mapUpdate },
}));
vi.mock("@/lib/modules/heroes/model.server", () => ({
  HeroModel: { updateOne: mocks.heroUpdate },
}));
vi.mock("@/lib/modules/players/model.server", () => ({
  PlayerModel: { updateOne: mocks.playerUpdate },
}));
vi.mock("@/lib/modules/stage-maps/generate", () => ({
  generateStageMap: vi.fn(() => []),
  rollSeed: vi.fn(() => 1),
}));

import { persistMineAction } from "./persist";

function state(mapVersion: number, coins: number): MineState {
  return {
    wallet: "wallet-a",
    coins,
    stage: 1,
    nodes: {
      "1,1": {
        x: 1,
        y: 1,
        kind: "chest",
        hp: mapVersion ? 0 : 1,
        maxHp: 1,
        coinReward: 10,
        destroyed: mapVersion > 0,
      },
    },
    totalNodes: 1,
    destroyedNodes: mapVersion ? 1 : 0,
    heroes: {
      hero1: { _id: "hero1", currentEnergy: 5 - mapVersion, maxEnergy: 5, power: 1, lastActionAt: 0 },
    },
    lastActionAt: mapVersion,
    mapVersion,
  };
}

describe("persistMineAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTransaction.mockImplementation(async (callback: () => Promise<void>) => callback());
    mocks.mapUpdate.mockResolvedValue({ matchedCount: 1 });
    mocks.heroUpdate.mockResolvedValue({ matchedCount: 1 });
    mocks.playerUpdate.mockResolvedValue({ matchedCount: 1 });
  });

  it("rejects a stale map version without committing rewards", async () => {
    mocks.mapUpdate.mockResolvedValue({ matchedCount: 0 });

    const result = await persistMineAction({
      prevState: state(0, 0),
      nextState: state(1, 10),
      stageComplete: false,
    });

    expect(result.status).toBe("conflict");
    expect(mocks.playerUpdate).not.toHaveBeenCalled();
  });

  it("uses authoritative sets and optimistic guards for retry safety", async () => {
    const result = await persistMineAction({
      prevState: state(0, 0),
      nextState: state(1, 10),
      stageComplete: false,
    });

    expect(result.status).toBe("ok");
    // Map CAS is guarded by unique playerId + mapVersion only. `stage` is NOT
    // part of the filter: it lives on a separate PlayerModel doc and, if drifted,
    // would abort the whole coin-bearing transaction on every flush.
    expect(mocks.mapUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ playerId: "wallet-a" }),
      {
        $set: expect.objectContaining({
          clearedChests: 1,
          mapVersion: 1,
          nodes: expect.any(Object),
        }),
      },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    // Player update uses wallet-only filter (no coins/stage guard) to avoid
    // spurious conflicts; the map CAS above is the real idempotency guard.
    expect(mocks.playerUpdate).toHaveBeenCalledWith(
      { wallet: "wallet-a" },
      { $set: { coins: 10, stage: 1 } },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(mocks.playerUpdate.mock.calls[0][1]).not.toHaveProperty("$inc");
  });

  it("assigns a CAS version to legacy mutations", async () => {
    await persistMineAction({
      prevState: state(0, 0),
      nextState: { ...state(0, 10), coins: 10 },
      stageComplete: false,
    });

    expect(mocks.mapUpdate.mock.calls[0][1].$set.mapVersion).toBe(1);
  });

  it("falls back to sequential writes on standalone MongoDB (no transactions)", async () => {
    // Simulate a standalone server: withTransaction throws the driver's
    // "replica set required" error. Progress must still be persisted.
    mocks.withTransaction.mockImplementation(async () => {
      const err = Object.assign(
        new Error("Transaction numbers are only allowed on a replica set member or mongos"),
        { code: 20, codeName: "IllegalOperation" },
      );
      throw err;
    });

    const result = await persistMineAction({
      prevState: state(0, 0),
      nextState: state(1, 10),
      stageComplete: false,
    });

    expect(result.status).toBe("ok");
    // The map/hero/player writes were still executed (without a session).
    expect(mocks.mapUpdate).toHaveBeenCalled();
    expect(mocks.playerUpdate).toHaveBeenCalledWith(
      { wallet: "wallet-a" },
      { $set: { coins: 10, stage: 1 } },
      {},
    );
  });

  it("still surfaces a version conflict even when the transaction path throws it", async () => {
    // A genuine CAS conflict must NOT be mistaken for "transactions unsupported".
    mocks.mapUpdate.mockResolvedValue({ matchedCount: 0 });
    mocks.withTransaction.mockImplementation(async (callback: () => Promise<void>) => callback());

    const result = await persistMineAction({
      prevState: state(0, 0),
      nextState: state(1, 10),
      stageComplete: false,
    });

    expect(result.status).toBe("conflict");
    // No blind sequential retry that would double-write.
    expect(mocks.playerUpdate).not.toHaveBeenCalled();
  });
});

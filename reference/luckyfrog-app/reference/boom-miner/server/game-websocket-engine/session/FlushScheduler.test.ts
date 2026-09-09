import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MineState } from "@/features/mine-action/types";
import type { SessionEntry } from "./SessionStore";
import { SessionStore } from "./SessionStore";

const mocks = vi.hoisted(() => ({
  buildMineState: vi.fn(),
  persistMineAction: vi.fn(),
}));

vi.mock("@/features/mine-action/build-state", () => ({
  buildMineState: mocks.buildMineState,
}));
vi.mock("@/features/mine-action/persist", () => ({
  persistMineAction: mocks.persistMineAction,
}));

import { FlushScheduler } from "./FlushScheduler";

function state(version = 0, coins = 0): MineState {
  return {
    wallet: "wallet-a",
    coins,
    stage: 1,
    nodes: {
      "1,1": {
        x: 1,
        y: 1,
        kind: "chest",
        hp: version > 0 ? 0 : 1,
        maxHp: 1,
        coinReward: 10,
        destroyed: version > 0,
      },
    },
    totalNodes: 1,
    destroyedNodes: version > 0 ? 1 : 0,
    heroes: {},
    lastActionAt: version,
    mapVersion: version,
  };
}

function entry(): SessionEntry {
  return {
    wallet: "wallet-a",
    state: state(1, 10),
    dirty: true,
    revision: 1,
    flushPromise: null,
    socketId: "socket-a",
    connectedAt: 0,
    lastActionAt: 1,
    lastFlushedState: state(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("FlushScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildMineState.mockResolvedValue(state());
  });

  it("serializes concurrent flushes and commits a snapshot once", async () => {
    const pending = deferred<unknown>();
    mocks.persistMineAction.mockReturnValueOnce(pending.promise);
    const session = entry();
    const scheduler = new FlushScheduler(new SessionStore());

    const first = scheduler.flushOne(session);
    const second = scheduler.flushOne(session);
    await vi.waitFor(() => expect(mocks.persistMineAction).toHaveBeenCalledTimes(1));

    pending.resolve({
      status: "ok",
      stageAdvanced: false,
      committedState: state(1, 10),
    });
    await Promise.all([first, second]);

    expect(mocks.persistMineAction).toHaveBeenCalledTimes(1);
    expect(session.dirty).toBe(false);
    expect(session.flushPromise).toBeNull();
  });

  it("keeps a mutation accepted during persistence dirty", async () => {
    const pending = deferred<unknown>();
    mocks.persistMineAction.mockReturnValueOnce(pending.promise);
    const session = entry();
    const scheduler = new FlushScheduler(new SessionStore());

    const flushing = scheduler.flushOne(session);
    await vi.waitFor(() => expect(mocks.persistMineAction).toHaveBeenCalledTimes(1));
    session.state = state(2, 20);
    session.revision = 2;
    session.dirty = true;

    pending.resolve({
      status: "ok",
      stageAdvanced: false,
      committedState: state(1, 10),
    });
    await flushing;

    expect(session.dirty).toBe(true);
    expect(session.lastFlushedState?.mapVersion).toBe(1);
    expect(session.state.mapVersion).toBe(2);
  });

  it.each(["failed", "conflict"] as const)(
    "retains the baseline and dirty flag after a %s result",
    async (status) => {
      mocks.persistMineAction.mockResolvedValue({
        status,
        stageAdvanced: false,
        errors: ["not committed"],
      });
      const session = entry();
      const baseline = session.lastFlushedState;
      const scheduler = new FlushScheduler(new SessionStore());

      await scheduler.flushOne(session);

      expect(session.dirty).toBe(true);
      expect(session.lastFlushedState).toBe(baseline);
    },
  );
});

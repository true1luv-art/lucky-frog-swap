import type { SessionEntry, SessionStore } from "./SessionStore";
import { persistMineAction } from "@/features/mine-action/persist";
import { buildMineState } from "@/features/mine-action/build-state";

const FLUSH_INTERVAL_MS = 5_000;

function cloneState<T>(value: T): T {
  return structuredClone(value);
}

export class FlushScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly store: SessionStore) {}

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      this.flushAll().catch((error) =>
        console.error("[FlushScheduler] periodic flush failed:", error),
      );
    }, FLUSH_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  async flushAll(): Promise<void> {
    const tasks = Array.from(this.store.all(), (entry) =>
      entry.dirty ? this.flushOne(entry) : Promise.resolve(),
    );
    await Promise.allSettled(tasks);
  }

  /** Queue a flush behind any write already running for this wallet. */
  async flushOne(entry: SessionEntry): Promise<void> {
    const previous = entry.flushPromise ?? Promise.resolve();
    const queued = previous
      .catch(() => undefined)
      .then(() => this.performFlush(entry));
    entry.flushPromise = queued;

    try {
      await queued;
    } finally {
      if (entry.flushPromise === queued) entry.flushPromise = null;
    }
  }

  private async performFlush(entry: SessionEntry): Promise<void> {
    if (!entry.dirty) return;

    let prevState = entry.lastFlushedState;
    if (!prevState) {
      prevState = await buildMineState(entry.wallet);
      if (!prevState) {
        console.error(`[FlushScheduler] no canonical state for ${entry.wallet}`);
        return;
      }
    }

    // Capture both values before awaiting. A hit accepted while persistence is
    // in flight changes entry.revision and remains dirty for the queued flush.
    const revision = entry.revision;
    const snapshot = cloneState(entry.state);
    const baseline = cloneState(prevState);
    const stageComplete =
      snapshot.totalNodes > 0 && snapshot.destroyedNodes >= snapshot.totalNodes;

    let result = await persistMineAction({
      prevState: baseline,
      nextState: snapshot,
      stageComplete,
    });

    // On a mapVersion conflict the in-memory lastFlushedState is stale — another
    // write (e.g. a stage advance or a concurrent legacy route) moved the DB
    // version forward. Re-read the canonical state from DB and retry once so
    // that earned coins and hero energy are not silently dropped.
    if (result.status === "conflict") {
      console.warn(
        `[FlushScheduler] conflict for ${entry.wallet} — refreshing baseline and retrying`,
      );
      const freshBaseline = await buildMineState(entry.wallet);
      if (freshBaseline) {
        entry.lastFlushedState = cloneState(freshBaseline);
        result = await persistMineAction({
          prevState: freshBaseline,
          nextState: snapshot,
          stageComplete,
        });
      }
    }

    if (result.status !== "ok" || !result.committedState) {
      console.error(
        `[FlushScheduler] persistence ${result.status} for ${entry.wallet}:`,
        result.errors,
      );
      return;
    }

    entry.lastFlushedState = cloneState(result.committedState);

    if (result.stageAdvanced) {
      // The committed state is the freshly-generated next stage. Snap in-memory
      // state to it so subsequent flushes diff against the correct baseline and
      // hits that arrive before the client reloads apply to the new map.
      entry.state = cloneState(result.committedState);
      entry.dirty = false;
      entry.revision = 0;
      entry.stageAdvanced = true;
    } else if (entry.revision === revision) {
      entry.dirty = false;
    }
  }
}

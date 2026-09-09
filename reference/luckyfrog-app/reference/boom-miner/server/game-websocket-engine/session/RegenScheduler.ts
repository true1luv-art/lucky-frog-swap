/**
 * server/game-websocket-engine/session/RegenScheduler.ts
 *
 * Server-authoritative energy regeneration for resting (off-map) heroes.
 *
 * This replaces the old client-driven `/api/heroes/energy-regen` route, where
 * the browser POSTed its own `deltaSec` — a value an attacker could inflate to
 * refill energy at will (security audit finding F-02). Here the elapsed time is
 * measured entirely from the server clock (SessionEntry.lastRegenAt), so the
 * client has no influence over how much energy is granted.
 *
 * Cadence: every REGEN_INTERVAL_MS the scheduler walks every active session and
 * persists the regen its resting heroes accrued since the last tick. The client
 * still simulates regen visually via gameStore.tickEnergy() using the identical
 * formula, and bootstrap/reconnect reconciles against these authoritative DB
 * values — so no per-tick broadcast is needed.
 */

import type { SessionStore } from "./SessionStore";
import { regenHeroEnergy } from "@/lib/modules/heroes/repository.server";

/** How often resting-hero energy is persisted. Matches the old write-back cadence. */
const REGEN_INTERVAL_MS = 60_000;

export class RegenScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly store: SessionStore) {}

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      this.tick().catch((error) =>
        console.error("[RegenScheduler] periodic regen failed:", error),
      );
    }, REGEN_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  async tick(): Promise<void> {
    const now = Date.now();
    const tasks: Promise<void>[] = [];

    for (const entry of this.store.all()) {
      // Baseline from the last tick, or the session's connect time on first run.
      const last = entry.lastRegenAt ?? entry.connectedAt;
      const deltaSec = (now - last) / 1000;
      if (deltaSec < 1) continue;

      // Advance the marker before awaiting so a slow write can't double-count.
      entry.lastRegenAt = now;

      tasks.push(
        regenHeroEnergy(entry.wallet, deltaSec).catch((err) =>
          console.error(`[RegenScheduler] regen failed for ${entry.wallet}:`, err),
        ),
      );
    }

    await Promise.allSettled(tasks);
  }
}

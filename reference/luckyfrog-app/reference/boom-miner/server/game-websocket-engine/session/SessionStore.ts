/**
 * server/game-websocket-engine/session/SessionStore.ts
 *
 * In-memory store of all active wallet sessions.
 * One entry per connected wallet — not per socket, so a reconnect
 * from the same wallet reuses the live MineState without a DB round-trip.
 *
 * The store is a plain Map. All mutations happen synchronously so there
 * is no race between concurrent socket events from the same wallet.
 */

import type { MineState } from "@/features/mine-action/types";

export interface SessionEntry {
  /** Wallet address — also the Map key. */
  wallet:       string;
  /** Live, mutable game state. Mutated in-place by handlers. */
  state:        MineState;
  /** True when state has changed since the last DB flush. */
  dirty:        boolean;
  /** Incremented for every accepted mutation; used to avoid clearing newer work. */
  revision:     number;
  /** Per-wallet mutex. Concurrent flush callers join this promise. */
  flushPromise: Promise<void> | null;
  /** Active socket id — updated on reconnect. */
  socketId:     string;
  /** Unix-ms when the session was first established. */
  connectedAt:  number;
  /**
   * Unix-ms of the last accepted mine:hit.
   * Used for rate limiting — duplicates the value in state.lastActionAt
   * so the store can enforce the check without touching state.
   */
  lastActionAt: number;
  /**
   * Snapshot of state as it was when the last DB flush completed.
   * FlushScheduler.flushOne() uses this as prevState for the next diff write (Phase D).
   *
   * null on a fresh session load — the DB state IS the baseline (buildMineState),
   * so no diff is needed for the first flush. Phase D handles this by treating
   * null as "write the full current state".
   */
  lastFlushedState: MineState | null;
  /**
   * Transient signal set by FlushScheduler when a stage advance occurred.
   * Checked by handlers.ts in Phase E to trigger an immediate SESSION_STATE broadcast
   * and a DB rebuild. Cleared after reading to prevent re-processing.
   */
  stageAdvanced?: boolean;
  /**
   * True while the socket is closed but the room is being retained in memory
   * so the player can reconnect into the exact same live state. Reset to false
   * when a new socket resumes the session.
   */
  disconnected?: boolean;
  /**
   * Pending grace-period eviction timer, armed on disconnect and cleared on
   * reconnect. When it fires (and no reconnect happened) the room is deleted.
   */
  evictTimer?: ReturnType<typeof setTimeout>;
  /**
   * Unix-ms of the last server-driven energy regen tick for this wallet.
   * RegenScheduler measures elapsed time from this (server clock only — never
   * a client-supplied delta) so resting-hero regen cannot be tampered with.
   */
  lastRegenAt?: number;
}

export class SessionStore {
  private sessions = new Map<string, SessionEntry>();

  /** Returns the entry for wallet, or undefined if not found. */
  get(wallet: string): SessionEntry | undefined {
    return this.sessions.get(wallet);
  }

  /** Creates or completely replaces the entry for wallet. */
  set(wallet: string, entry: SessionEntry): void {
    this.sessions.set(wallet, entry);
  }

  /** Removes the entry. Called on clean disconnect after final flush. */
  delete(wallet: string): void {
    this.sessions.delete(wallet);
  }

  /** All entries — iterated by FlushScheduler on each 30s tick. */
  all(): IterableIterator<SessionEntry> {
    return this.sessions.values();
  }

  has(wallet: string): boolean {
    return this.sessions.has(wallet);
  }

  size(): number {
    return this.sessions.size;
  }
}

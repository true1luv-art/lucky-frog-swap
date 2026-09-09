/**
 * Farming game Zustand store — isolated from the Lucky Frog auth/player system.
 * Persists under the key "luckyfrog:farm" in localStorage.
 *
 * Sprint 2.2: Hybrid mode — optimistic local state + background server sync. §2.2-B
 * Sprint 2.6: Server-first hydration; localStorage is an offline cache only. §2.6-C
 *
 * Architecture:
 * - On mount (via `hydrateFarm()`): always fetches GET /api/farm FIRST.
 *   Server state wins for all numeric/world values. localStorage is used only as a
 *   fallback when the server is unreachable (offline / unauthenticated). §2.6-C
 * - A `stateVersion` field is incremented on each server sync. If the cached
 *   localStorage stateVersion is older than the server response, server always wins.
 * - On every `send(action)` the action is also fired to POST /api/farm/action
 *   (fire-and-forget). On server error (422) the optimistic local change is rolled
 *   back to the pre-action snapshot and an error is published on `lastActionError`.
 * - `resetToServerState()` clears local state and refetches from server.
 * - `lastActionError` holds the most recent server error message (or null) so the
 *   Phaser UI can read it and show a brief toast. §2.6-D
 *
 * localStorage is ONLY written by Zustand's `persist` middleware (partialize).
 * No component or event handler should call localStorage.setItem directly.
 *
 * Actions follow the hearthvale Options pattern: { state, action, createdAt? }.
 * The store's `send()` wraps an action in a GameEvent and calls processGameEvent.
 */

import Decimal from "decimal.js-light";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GameState } from "@/shared/types/gameplay";
import type { GameAction, GameEvent } from "@/lib/events";
import { processGameEvent } from "@/lib/events";
import { INITIAL_FARM } from "@/shared/game/constants";

// ---------------------------------------------------------------------------
// Sync status
// ---------------------------------------------------------------------------

export type SyncStatus = "idle" | "syncing" | "error";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface FarmStore {
  state:            GameState;
  hydrated:         boolean;
  syncStatus:       SyncStatus;
  lastServerSync:   number;    // Unix ms of last successful server sync
  /** Monotonically increasing version counter; incremented on each server sync. §2.6-C */
  stateVersion:     number;
  /** Most recent server-side action error message, or null. §2.6-D */
  lastActionError:  string | null;

  send:               (action: GameAction) => void;
  /** Alias for send — used by UI components that expect hearthvale's `dispatch` API. */
  dispatch:           (action: GameAction) => void;
  reset:              () => void;
  /** Reconcile a state returned by an authoritative mutation response. */
  reconcileServerState: (state: GameState) => void;
  /** Clear local state and refetch canonical state from the server. §2.2-E */
  resetToServerState: () => Promise<void>;
  /**
   * Fetch `/api/farm` and merge the server state into the local store.
   * On mount, always fetches server state first; localStorage is a cache fallback. §2.6-C
   */
  hydrateFarm:        () => Promise<void>;
  /** Clear the last action error (called after toast is shown). §2.6-D */
  clearActionError:   () => void;
  _setHydrated:       () => void;
}

// ---------------------------------------------------------------------------
// SSR-safe localStorage wrapper
// ---------------------------------------------------------------------------

const safeLocalStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  },
};

// ---------------------------------------------------------------------------
// Decimal serialisation helpers
// ---------------------------------------------------------------------------

function decimalReplacer(_k: string, v: unknown): unknown {
  if (v instanceof Decimal) return { __decimal: v.toString() };
  return v;
}

function decimalReviver(_k: string, v: unknown): unknown {
  if (v && typeof v === "object" && "__decimal" in (v as object)) {
    return new Decimal((v as { __decimal: string }).__decimal);
  }
  return v;
}

// ---------------------------------------------------------------------------
// Server state merger §2.2-B
//
// Strategy: server wins for all numeric / inventory values; local wins for
// cosmetics (username, avatarUrl, farmAddress) and animation-only state.
// ---------------------------------------------------------------------------

function mergeServerState(local: GameState, server: GameState): GameState {
  return {
    ...local,
    // Server-authoritative numerics
    balance:            server.balance,
    inventory:          server.inventory,
    fields:             server.fields,
    trees:              server.trees,
    stones:             server.stones,
    iron:               server.iron,
    gold:               server.gold,
    chickens:           server.chickens,
    cows:               server.cows,
    sheep:              server.sheep,
    stamina:            server.stamina,
    lastStaminaRegenAt: server.lastStaminaRegenAt,
    fishing:            server.fishing,
    cooking:            server.cooking,
    skills:             server.skills,
    bonus:              server.bonus,
    ownedCollectibles:  server.ownedCollectibles,
    activity:           server.activity,
    achievements:       server.achievements,
    // Local cosmetics win
    username:    local.username    ?? server.username,
    avatarUrl:   local.avatarUrl   ?? server.avatarUrl,
    farmAddress: local.farmAddress ?? server.farmAddress,
  };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetches GET /api/farm and revives Decimal instances.
 * Returns null on any network or auth error.
 * Also returns `lastSyncAt` from the server for version comparison. §2.6-C
 */
async function fetchServerFarm(): Promise<{ state: GameState; lastSyncAt: number } | null> {
  try {
    const res = await fetch("/api/farm", { credentials: "include" });
    if (!res.ok) return null;
    const json = await res.json() as { success?: boolean; state?: unknown; lastSyncAt?: number };
    if (!json.success || !json.state) return null;
    // Revive __decimal → Decimal
    const raw = JSON.stringify(json.state);
    const state = JSON.parse(raw, decimalReviver) as GameState;
    return { state, lastSyncAt: json.lastSyncAt ?? Date.now() };
  } catch {
    return null;
  }
}

/**
 * Fetches GET /api/game-stats and returns the current halving emission
 * multiplier. Used to scale client-side buy/sell prices. §5 Step 4.
 * Returns 1 (Genesis) on any network/parse error or missing/invalid value.
 */
async function fetchHalvingMultiplier(): Promise<number> {
  try {
    const res = await fetch("/api/game-stats", { credentials: "include" });
    if (!res.ok) return 1;
    const json = await res.json() as { emissionMultiplier?: number };
    const m = json.emissionMultiplier;
    return typeof m === "number" && Number.isFinite(m) && m > 0 ? m : 1;
  } catch {
    return 1;
  }
}

/**
 * Fire-and-forget: sends a farm action to the server.
 * On success, reconciles the returned state with the local store.
 * On server-side validation failure (422) passes the error message to onError. §2.6-D
 */
async function fireActionToServer(
  action: GameAction,
  createdAt: number,
  reconcile: (serverState: GameState) => void,
  onError: (message: string) => void,
): Promise<void> {
  try {
    const { type, ...payload } = action as unknown as Record<string, unknown>;
    const res = await fetch("/api/farm/action", {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ type, payload, createdAt }),
    });
    if (!res.ok) {
      // Attempt to extract the server error message for the toast
      try {
        const errJson = await res.json() as { error?: string };
        onError(errJson.error ?? "Action failed");
      } catch {
        onError("Action failed");
      }
      return;
    }
    const json = await res.json() as { success?: boolean; state?: unknown };
    if (!json.success || !json.state) { onError("Invalid server response"); return; }
    const raw = JSON.stringify(json.state);
    const serverState = JSON.parse(raw, decimalReviver) as GameState;
    reconcile(serverState);
  } catch {
    onError("Network error");
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<FarmStore>()(
  persist(
    (set, get) => {
      // -----------------------------------------------------------------------
      // Action send queue — §perf
      //
      // Every `send()` applies an instant optimistic local update, then enqueues
      // the action here. The queue is drained ONE request at a time so we never
      // have more than a single POST /api/farm/action in flight. This:
      //   - prevents the request pileup that caused severe lag when the server
      //     was slow (many parallel 5s requests hammering the DB);
      //   - preserves action ordering (the server replays actions incrementally,
      //     so parallel sends would read the same base state and clobber each
      //     other — a lost-update bug);
      //   - self-throttles bursts of rapid interactions.
      // -----------------------------------------------------------------------
      const actionQueue: Array<{ action: GameAction; createdAt: number }> = [];
      let draining = false;

      async function drainQueue(): Promise<void> {
        if (draining) return;
        draining = true;

        while (actionQueue.length > 0) {
          const item = actionQueue[0];
          let failed = false;

          await fireActionToServer(
            item.action,
            item.createdAt,
            (serverState) => {
              // Only merge authoritative server state when this is the LAST
              // pending action. While more actions are still queued, the server
              // hasn't seen them yet, so merging its (older) numerics would
              // visibly revert the optimistic updates and cause flicker.
              const isLast = actionQueue.length <= 1;
              set((s) => ({
                state:           isLast ? mergeServerState(s.state, serverState) : s.state,
                syncStatus:      isLast ? "idle" : "syncing",
                lastServerSync:  Date.now(),
                stateVersion:    s.stateVersion + 1,
                lastActionError: null,
              }));
            },
            (message: string) => {
              failed = true;
              set({ syncStatus: "error", lastActionError: message });
            },
          );

          actionQueue.shift();

          if (failed) {
            // A rejected action invalidates any queued optimistic actions built
            // on top of it. Drop them and resync authoritative state so local
            // and server converge. §2.6-D
            actionQueue.length = 0;
            draining = false;
            void get().resetToServerState();
            return;
          }
        }

        draining = false;
      }

      return {
      state:           { ...INITIAL_FARM },
      hydrated:        false,
      syncStatus:      "idle" as SyncStatus,
      lastServerSync:  0,
      stateVersion:    0,   // §2.6-C: incremented on each successful server sync
      lastActionError: null, // §2.6-D: last server-side action rejection message

      send(action: GameAction) {
        // 1. Optimistic local update (instant) — keeps the game responsive
        //    regardless of network/server latency.
        const createdAt = Date.now();
        const event: GameEvent = { action, createdAt };
        const next = processGameEvent(get().state, event);
        set({ state: next, syncStatus: "syncing", lastActionError: null });

        // 2. Enqueue for background send; the queue drains one request at a time.
        actionQueue.push({ action, createdAt });
        void drainQueue();
      },

      dispatch(action: GameAction) {
        get().send(action);
      },

      reset() {
        set({ state: { ...INITIAL_FARM, lastStaminaRegenAt: Date.now() } });
      },

      reconcileServerState(serverState: GameState) {
        set((current) => ({
          state: mergeServerState(current.state, serverState),
          syncStatus: "idle",
          lastServerSync: Date.now(),
          stateVersion: current.stateVersion + 1,
          lastActionError: null,
        }));
      },

      clearActionError() {
        set({ lastActionError: null });
      },

      async resetToServerState() {
        set({ syncStatus: "syncing" });
        const result = await fetchServerFarm();
        if (result) {
          set((s) => ({
            state:          result.state,
            syncStatus:     "idle",
            lastServerSync: result.lastSyncAt,
            stateVersion:   s.stateVersion + 1,
          }));
        } else {
          set({ syncStatus: "error" });
        }
      },

      async hydrateFarm() {
        // §2.6-C: Only hydrate if we're in a browser context
        if (typeof window === "undefined") return;
        set({ syncStatus: "syncing" });

        // Always fetch server state first — localStorage is an offline fallback only.
        // The halving multiplier is fetched in parallel so buy/sell prices reflect
        // the current emission stage as soon as the game loads. §5 Step 4b.
        const [result, halvingMultiplier] = await Promise.all([
          fetchServerFarm(),
          fetchHalvingMultiplier(),
        ]);
        if (result) {
          // Server state wins for all numeric/world values; version tracks freshness.
          set((s) => ({
            state:          { ...mergeServerState(s.state, result.state), halvingMultiplier },
            syncStatus:     "idle",
            lastServerSync: result.lastSyncAt,
            stateVersion:   s.stateVersion + 1,
          }));
        } else {
          // Server unavailable or unauthenticated — keep cached localStorage state
          // but still apply the freshly fetched multiplier. Offline fallback only.
          set((s) => ({ state: { ...s.state, halvingMultiplier }, syncStatus: "idle" }));
        }
      },

      _setHydrated() {
        set({ hydrated: true });
      },
      };
    },
    {
      name: "luckyfrog:farm",
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ state: s.state }),
      // Revive Decimal instances from serialised JSON
      merge(persisted, current) {
        if (!persisted || !(persisted as { state?: unknown }).state) return current;
        try {
          const raw = JSON.stringify((persisted as { state: unknown }).state);
          const restored = JSON.parse(raw, decimalReviver) as GameState;
          return { ...current, state: restored };
        } catch {
          return current;
        }
      },
      onRehydrateStorage: () => (store) => {
        store?._setHydrated();
      },
    }
  )
);

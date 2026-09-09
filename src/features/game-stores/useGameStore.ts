/**
 * Farming game Zustand store — isolated from the auth/player system.
 * Persists under the key "hfarm:game" in localStorage.
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
import type { GameState } from "@/features/types/gameplay";
import type { GameAction, GameEvent } from "@/features/events";
import { processGameEvent } from "@/features/events";
import { INITIAL_SKILLS } from "@/features/types/gameplay/skills";
import { createInitialEquipment } from "@/features/types/gameplay/equipment";
import { INITIAL_HP } from "@/features/game/hp";

// ---------------------------------------------------------------------------
// Initial state — used as the default store state and the reset target
// ---------------------------------------------------------------------------

// All plots start empty — player plants their first crop after buying seeds from the Market.
const INITIAL_FIELDS: GameState["fields"] = {};

// 8 trees matching TREE_POSITIONS (tree_01 … tree_08) in phaser/positions/treePositions.ts
const INITIAL_TREES: GameState["trees"] = {
  0: { name: "Wood", choppedAt: 0 },
  1: { name: "Wood", choppedAt: 0 },
  2: { name: "Wood", choppedAt: 0 },
  3: { name: "Wood", choppedAt: 0 },
  4: { name: "Wood", choppedAt: 0 },
  5: { name: "Wood", choppedAt: 0 },
  6: { name: "Wood", choppedAt: 0 },
  7: { name: "Wood", choppedAt: 0 },
};

// 6 stone nodes matching STONE_POSITIONS (stone_01 … stone_06)
const INITIAL_STONE: GameState["stones"] = {
  0: { name: "Stone", minedAt: 0 },
  1: { name: "Stone", minedAt: 0 },
  2: { name: "Stone", minedAt: 0 },
  3: { name: "Stone", minedAt: 0 },
  4: { name: "Stone", minedAt: 0 },
  5: { name: "Stone", minedAt: 0 },
};



const INITIAL_FARM: GameState = {
  farmLevel: 1,
  fields:    INITIAL_FIELDS,
  // No starter items — player buys seeds from the Market.
    items: {},
  /**
   * New player starts with one of each free Wood tool (infinite durability).
   * Wood tools are created by craftTool at first login.
   */
  tools: [
    { id: "axe-wood-default",         name: "Axe",          tier: "Wood", durability: null, maxDurability: null },
    { id: "pickaxe-wood-default",      name: "Pickaxe",      tier: "Wood", durability: null, maxDurability: null },
    { id: "rod-wood-default",          name: "Rod",          tier: "Wood", durability: null, maxDurability: null },
    { id: "wateringcan-wood-default",  name: "Watering Can", tier: "Wood", durability: null, maxDurability: null },
  ],
  trees:    INITIAL_TREES,
  stones:   INITIAL_STONE,
  chickens: {},
  cows:     {},
  sheep:    {},
  skills:   { ...INITIAL_SKILLS },
  equipment: createInitialEquipment(),
  coins:   new Decimal(0),
  hp: INITIAL_HP,
  fishing: {
    lastCastAt:     0,
    lastCaughtFish: null,
  },
  milestones: {},
  quests: {
    daily: [],
  },
};

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
    farmLevel:          server.farmLevel ?? local.farmLevel ?? 1,
        items: server.items, // keep alias in sync
    tools:              server.tools ?? local.tools ?? [],
    fields:             server.fields,
    trees:              server.trees,
    stones:             server.stones,
    chickens:           server.chickens,
    cows:               server.cows,
    sheep:              server.sheep,
    fishing:            server.fishing,
    skills:             server.skills,

    equipment:          server.equipment,
    milestones:         server.milestones,
    // Coins and HP: server is authoritative; fall back to local optimistic values.
    coins:          server.coins          ?? local.coins,
    hp:             server.hp             ?? local.hp,
    // Local cosmetics win
    username:    local.username    ?? server.username,
    avatarUrl:   local.avatarUrl   ?? server.avatarUrl,
    farmAddress: local.farmAddress ?? server.farmAddress,
  };
}

// ---------------------------------------------------------------------------
// Demo mode detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the player is in demo mode (rhf_demo=1 cookie).
 * In demo mode all server syncs are skipped — the game runs fully client-side
 * and progress is not saved.
 */
/**
 * Local-only mode. This build has no backend — all game state lives in the
 * Zustand store and is persisted to localStorage. Server sync is disabled.
 */
export const LOCAL_ONLY = true;

function isDemo(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith("rhf_demo=1"));
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetches GET /api/farm and revives Decimal instances.
 * Returns null on any network or auth error.
 * Also returns `lastSyncAt` from the server for version comparison. §2.6-C
 */
async function fetchServerFarm(): Promise<
  | { state: GameState; lastSyncAt: number }
  | { authError: true }
  | null
> {
  try {
    const res = await fetch("/api/farm", { credentials: "include" });
    // 401 = no/invalid token, 404 = player deleted — both require logout.
    if (res.status === 401 || res.status === 404) return { authError: true };
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
        set({ state: next, syncStatus: "idle", lastActionError: null });

        // 2. Demo mode — all game logic is client-side only, no server sync.
        if (LOCAL_ONLY || isDemo()) return;

        // 3. Enqueue for background send; the queue drains one request at a time.
        set({ syncStatus: "syncing" });
        actionQueue.push({ action, createdAt });
        void drainQueue();
      },

      dispatch(action: GameAction) {
        get().send(action);
      },

      reset() {
        // Clear the demo cookie on logout so the next visit goes to login.
        if (isDemo() && typeof document !== "undefined") {
          document.cookie = "rhf_demo=; path=/; max-age=0";
        }
        set({ state: { ...INITIAL_FARM } });
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
        // Local-only build: there is no server, so "reset" restarts the farm.
        set((s) => ({
          state:          { ...INITIAL_FARM },
          syncStatus:     "idle",
          lastServerSync: Date.now(),
          stateVersion:   s.stateVersion + 1,
          lastActionError: null,
        }));
      },

      async hydrateFarm() {
        // §2.6-C: Only hydrate if we're in a browser context
        if (typeof window === "undefined") return;

        // Local-only build: keep whatever the persist middleware restored and
        // fill in any fields added since the save was written.
        if (LOCAL_ONLY) {
          set((s) => ({
            state:          { ...INITIAL_FARM, ...s.state, username: s.state.username ?? "Farmer" },
            syncStatus:     "idle",
            lastServerSync: Date.now(),
            stateVersion:   s.stateVersion + 1,
          }));
          return;
        }

        // Demo mode — seed from INITIAL_FARM, no server fetch, no DB writes.
        if (isDemo()) {
          set({
            state:          { ...INITIAL_FARM, username: "Demo" },
            syncStatus:     "idle",
            lastServerSync: Date.now(),
            stateVersion:   1,
          });
          return;
        }

        set({ syncStatus: "syncing" });

        // Always fetch server state first — localStorage is an offline fallback only.
        const result = await fetchServerFarm();
        if (result && "authError" in result) {
          // JWT is valid but player no longer exists in DB (deleted account).
          // Clear any stale local state and send them back to the landing page.
          set({ syncStatus: "idle" });
          window.location.replace("/");
          return;
        }
        if (result && "state" in result) {
          // Server state wins for all numeric/world values; version tracks freshness.
          const serverResult = result as { state: GameState; lastSyncAt: number };
          set((s) => ({
            state:          mergeServerState(s.state, serverResult.state),
            syncStatus:     "idle",
            lastServerSync: serverResult.lastSyncAt,
            stateVersion:   s.stateVersion + 1,
          }));
        } else {
          // Network error / server unavailable — keep cached localStorage state.
          set({ syncStatus: "idle" });
        }
      },

      _setHydrated() {
        set({ hydrated: true });
      },
      };
    },
    {
      name: "hfarm:game",
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

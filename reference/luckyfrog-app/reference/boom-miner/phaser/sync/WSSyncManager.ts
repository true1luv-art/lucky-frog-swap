/**
 * phaser/sync/WSSyncManager.ts
 *
 * The ONLY gameplay transport. Requires NEXT_PUBLIC_WS_URL to be set.
 * It sends each mine:hit / bomb:detonate immediately over a persistent
 * Socket.IO connection and listens for real-time ack/reject responses and
 * authoritative state pushes (SESSION_STATE) from the WS engine.
 *
 * IMPORTANT — socket lifetime vs. Phaser scene lifetime
 * -----------------------------------------------------
 * Phaser calls `TreasureScene.create()` again on every `scene.restart()`
 * (which happens on each stage advance). If each scene created its own
 * socket, the server would treat the second connection as a new tab and kick
 * the first ("REPLACED_BY_NEW_TAB"), and the reconnect overlay would flash on
 * every stage transition. To avoid that, the underlying Socket.IO connection
 * is a module-level singleton keyed to the browser tab. Scenes attach their
 * apply-target and detach on shutdown, but the socket persists across
 * restarts and is only torn down when the whole Phaser game unmounts
 * (PhaserGame calls destroySocket() from SocketContext).
 */

import type { Socket } from "socket.io-client";
import { getSocket, initSocket, destroySocket } from "@/context/SocketContext";
import type { SyncLogResponse } from "@/features/types/sync";
import { useGameStore } from "@/features/store/gameStore";
import { WS_EVENTS } from "@/server/game-websocket-engine/socket/events";
import type {
  MineHitPayload,
  MineHitAckPayload,
  MineHitRejectPayload,
  HeroUndeployPayload,
  BombDetonatePayload,
  BombDetonateAckPayload,
  BombDetonateRejectPayload,
  HeroDeployPayload,
  HeroDeployAckPayload,
  HeroDeployRejectPayload,
  PlayerStatePayload,
} from "@/server/game-websocket-engine/socket/events";
import { MAX_ON_MAP } from "@/lib/constants/game";

export type ApplyServerStateFn = (canonicalState: SyncLogResponse["canonicalState"]) => void;

// ---------------------------------------------------------------------------
// Module-level state (one per browser tab, survives scene restarts)
// ---------------------------------------------------------------------------

let sharedSeq = 0;
/** The currently-active WSSyncManager whose apply-target receives events. */
let activeManager: WSSyncManager | null = null;

/**
 * Deploy (onMap:true) or recall (onMap:false) a hero over the shared socket.
 * The caller should already have applied the optimistic store change. Returns
 * false if the socket isn't connected, so the caller can roll back and warn.
 * The authoritative result arrives asynchronously via HERO_DEPLOY_ACK / REJECT.
 */
export function sendHeroDeploy(heroId: string, onMap: boolean): boolean {
  const socket = getSocket();
  if (!socket?.connected) {
    console.warn("[WSSyncManager] sendHeroDeploy called but socket not connected");
    return false;
  }
  const payload: HeroDeployPayload = { heroId, onMap, seq: ++sharedSeq };
  socket.emit(WS_EVENTS.HERO_DEPLOY, payload);
  return true;
}

export class WSSyncManager {
  private applyServerState: ApplyServerStateFn;
  /** True once TreasureScene signals the map is fully initialised. */
  private mapReady          = false;
  /** Buffers a canonicalState received before the map was ready. */
  private pendingCanonical: SyncLogResponse["canonicalState"] | null = null;

  constructor(applyServerState: ApplyServerStateFn) {
    this.applyServerState = applyServerState;
  }

  /**
   * Called by TreasureScene after MapManager finishes loading the map.
   * Flushes any canonicalState that arrived before the map was ready.
   */
  notifyMapReady(): void {
    this.mapReady = true;
    if (this.pendingCanonical) {
      this.applyServerState(this.pendingCanonical);
      this.pendingCanonical = null;
    }
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  /**
   * Attach this manager to the shared socket. Calls `initSocket()` (from
   * SocketContext) on first use; subsequent calls after a scene restart simply
   * re-point the active apply-target at this new manager without reconnecting.
   * All event listeners are registered once on the shared socket instance.
   */
  start(): void {
    activeManager = this;

    // Get the shared socket, creating it on first boot. After a logout/login
    // cycle destroySocket() nulls the singleton, so this re-creates a fresh one.
    const socket: Socket = getSocket() ?? initSocket();

    // Attach gameplay + connection listeners. This MUST run on every start(),
    // not just first boot: if the socket was created elsewhere (e.g. initSocket()
    // called by PhaserGame before start(), which happens on a re-login), the old
    // "first boot only" path skipped binding entirely — so the socket connected
    // but connectionLost was never cleared and the reconnect overlay stuck open.
    // bindSocketListeners is idempotent per socket instance (scene restarts reuse
    // the same socket; a fresh post-login socket gets a clean set of listeners).
    this.bindSocketListeners(socket);

    // Reflect the current connection status and resync the fresh map/state.
    useGameStore.getState().setConnectionLost(!socket.connected);
    if (socket.connected) {
      socket.emit(WS_EVENTS.SESSION_SYNC);
    }
  }

  /**
   * Register all gameplay + connection event handlers on the shared socket.
   * Guarded so it binds exactly once per socket instance: scene restarts reuse
   * the same socket (skip re-binding to avoid duplicate handlers), while a fresh
   * socket created after a logout/login cycle gets a clean set of listeners.
   */
  private bindSocketListeners(socket: Socket): void {
    const bound = socket as Socket & { __bmBound?: boolean };
    if (bound.__bmBound) return;
    bound.__bmBound = true;

    // Game-specific store bindings on top of what SocketContext already wires.
    socket.on("connect", () => {
      useGameStore.getState().setConnectionLost(false);
      // Re-request authoritative state after any (re)connect so the map is fresh.
      socket.emit(WS_EVENTS.SESSION_SYNC);
    });

    socket.on("connect_error", (err: Error) => {
      // AUTH errors are terminal — the server rejected the WS handshake because
      // the JWT is missing or expired. SocketContext already called destroySocket()
      // so auto-reconnect is dead. Surface a clear session-expired message via the
      // SessionErrorOverlay (same path as REPLACED_BY_NEW_TAB) instead of showing
      // the generic "Waiting to reconnect…" overlay which would spin forever.
      if (
        err.message === "AUTH_MISSING_TOKEN" ||
        err.message === "AUTH_INVALID_TOKEN"
      ) {
        useGameStore.getState().setSessionError(
          "Your session has expired. Please log in again.",
        );
        return;
      }
      useGameStore.getState().setConnectionLost(true);
    });

    socket.on("disconnect", () => {
      useGameStore.getState().setConnectionLost(true);
    });

    // Full canonical state pushed by the server on connect or on sync request.
    // Buffer it if the map isn't initialised yet; flush in notifyMapReady().
    socket.on(WS_EVENTS.SESSION_STATE, (payload: { canonicalState: SyncLogResponse["canonicalState"] }) => {
      const mgr = activeManager;
      if (!mgr) return;
      if (mgr.mapReady) {
        mgr.applyServerState(payload.canonicalState);
      } else {
        mgr.pendingCanonical = payload.canonicalState;
      }
    });

    // Server acked the hit — apply any canonical corrections.
    socket.on(WS_EVENTS.MINE_HIT_ACK, (_payload: MineHitAckPayload) => {
      // The client simulation is already ahead; acks are currently informational.
    });

    // Server rejected the hit — request a full state resync to correct local state.
    socket.on(WS_EVENTS.MINE_HIT_REJECT, (payload: MineHitRejectPayload) => {
      console.warn(`[WSSyncManager] hit rejected seq=${payload.seq} code=${payload.code}: ${payload.reason}`);
      socket.emit(WS_EVENTS.SESSION_SYNC);
    });

    // Server acked a whole bomb detonation — apply authoritative coins + energy.
    socket.on(WS_EVENTS.BOMB_DETONATE_ACK, (payload: BombDetonateAckPayload) => {
      const store = useGameStore.getState();
      store.hydrateFromServer(payload.coinsTotal, payload.stage);
      store.patchRosterEnergy({ [payload.heroId]: payload.heroEnergy });
    });

    // Server rejected a detonation. Only resync when the session itself is gone
    // (a blind resync otherwise resurrects tiles the client already destroyed).
    socket.on(WS_EVENTS.BOMB_DETONATE_REJECT, (payload: BombDetonateRejectPayload) => {
      console.warn(`[WSSyncManager] detonation rejected seq=${payload.seq} code=${payload.code}: ${payload.reason}`);
      if (payload.code === "SESSION_GONE") {
        socket.emit(WS_EVENTS.SESSION_SYNC);
      }
    });

    // Authoritative off-map economy + roster push (mint / withdrawal settled).
    // Fired in response to PLAYER_SYNC by the global settlement poller. We take
    // coins + stage + roster straight from the server so balance and hero list
    // can't drift after a settlement.
    socket.on(WS_EVENTS.PLAYER_STATE, (payload: PlayerStatePayload) => {
      const store = useGameStore.getState();
      store.hydrateFromServer(payload.coins, payload.stage);
      store.hydrateRoster(payload.heroes);
    });

    socket.on(WS_EVENTS.SESSION_ERROR, (payload: { message: string }) => {
      console.error("[WSSyncManager] session error:", payload.message);
      if (payload.message === "REPLACED_BY_NEW_TAB") {
        // Stop reconnecting — this tab was intentionally kicked.
        destroySocket();
        useGameStore.getState().setSessionError(
          "You opened the game in another tab. This tab has been disconnected.",
        );
      }
    });

    // Server confirmed a hero has run out of energy — remove from map immediately.
    socket.on(WS_EVENTS.HERO_UNDEPLOY, (payload: HeroUndeployPayload) => {
      useGameStore.getState().setHeroOnMap(payload.heroId, false);
    });

    // Deploy/recall accepted — reconcile authoritative energy and clear errors.
    socket.on(WS_EVENTS.HERO_DEPLOY_ACK, (payload: HeroDeployAckPayload) => {
      const store = useGameStore.getState();
      store.setDeployError(null);
      store.patchRosterEnergy({ [payload.heroId]: payload.currentEnergy });
    });

    // Deploy/recall rejected — roll back the optimistic change and surface why.
    socket.on(WS_EVENTS.HERO_DEPLOY_REJECT, (payload: HeroDeployRejectPayload) => {
      console.warn(`[WSSyncManager] deploy rejected heroId=${payload.heroId} code=${payload.code}: ${payload.reason}`);
      const store = useGameStore.getState();
      store.setHeroOnMap(payload.heroId, !payload.onMap);
      const msg =
        payload.code === "INSUFFICIENT_ENERGY" ? "Not enough energy" :
        payload.code === "MAP_FULL"             ? `Map is full (max ${MAX_ON_MAP})` :
        payload.code === "NOT_DEPLOYED"         ? "Hero is already home" :
        payload.code === "STALE_STATE"          ? "Deploy state changed — please retry" :
        (payload.reason ?? "Deploy failed");
      store.setDeployError(msg);
    });
  }

  /**
   * Detach this manager from the shared socket (called on scene shutdown).
   * Does NOT disconnect — the socket persists across scene restarts.
   * Use destroySocket() from SocketContext to fully tear the connection down.
   */
  detach(): void {
    if (activeManager === this) activeManager = null;
  }

  /** No-op — activity tracking is not needed for WebSocket (every hit is real-time). */
  markActivity(): void {}

  /**
   * Sends a single mine:hit to the WS engine.
   */
  sendHit(heroId: string, nodeKey: string): void {
    const socket = getSocket();
    if (!socket?.connected) {
      console.warn("[WSSyncManager] sendHit called but socket not connected");
      return;
    }
    const payload: MineHitPayload = {
      heroId,
      nodeKey,
      seq:  ++sharedSeq,
      tick: Date.now(),
    };
    socket.emit(WS_EVENTS.MINE_HIT, payload);
  }

  /**
   * Sends a single whole-bomb detonation to the WS engine, carrying every
   * destructible node the blast touched plus the hero's power.
   */
  sendBombDetonate(heroId: string, nodeKeys: string[], power: number): void {
    const socket = getSocket();
    if (!socket?.connected) {
      console.warn("[WSSyncManager] sendBombDetonate called but socket not connected");
      return;
    }
    const payload: BombDetonatePayload = {
      heroId,
      nodeKeys,
      power,
      seq:  ++sharedSeq,
      tick: Date.now(),
    };
    socket.emit(WS_EVENTS.BOMB_DETONATE, payload);
  }

  /**
   * On stage complete: tell the server to flush immediately.
   */
  async flush(): Promise<void> {
    const socket = getSocket();
    if (!socket?.connected) return;
    socket.emit(WS_EVENTS.SESSION_COMPLETE);
    // Give the server a moment to process before the scene restarts.
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
  }
}

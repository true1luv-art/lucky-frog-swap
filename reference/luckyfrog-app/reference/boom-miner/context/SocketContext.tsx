"use client";

/**
 * context/SocketContext.ts
 *
 * NOTE: This file intentionally mixes React hooks and imperative module-level
 * state. The module-level singleton (`_socket`) is safe for Phaser scenes to
 * consume directly via `getSocket()`.  React components use the hooks below.
 *
 * Provides a singleton Socket.IO client instance that is shared across React
 * components AND can be imported directly into Phaser scenes.
 *
 * Architecture
 * ─────────────
 * The socket is managed at the module level (one per browser tab) so that:
 *  - React components can read connection state via `useSocket()` / `useSocketState()`.
 *  - Phaser scenes can call `getSocket()` / `getSharedSocket()` directly without
 *    needing React hooks (Phaser lives outside the React tree).
 *  - The socket survives Phaser scene restarts (TreasureScene re-creates on each
 *    stage advance) without triggering a REPLACED_BY_NEW_TAB kick from the server.
 *  - `destroySocket()` is called once when PhaserGame unmounts (navigating away /
 *    logout) to cleanly close the connection.
 *
 * Usage in React
 * ──────────────
 * ```tsx
 * // Read-only connection state (no re-render on every event):
 * const { connected, error } = useSocketState();
 *
 * // Full socket access (use sparingly — prefer event helpers):
 * const socket = useSocket();
 * ```
 *
 * Usage in Phaser
 * ───────────────
 * ```ts
 * import { getSocket } from "@/context/SocketContext";
 *
 * const socket = getSocket(); // always returns the shared instance
 * socket?.emit("mine:hit", payload);
 * ```
 *
 * Initialisation
 * ──────────────
 * Call `initSocket()` once before Phaser boots (e.g. inside GamePage's
 * `useEffect` or the DynamicGameShell). It reads `bm_token` from localStorage
 * and connects to `NEXT_PUBLIC_WS_URL`. Subsequent calls are no-ops if the
 * socket is already open.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let _socket: Socket | null = null;

/** Connection status tracked independently so React can subscribe. */
export interface SocketState {
  connected: boolean;
  error: string | null;
}

let _state: SocketState = { connected: false, error: null };
const _listeners = new Set<(s: SocketState) => void>();

function _setState(patch: Partial<SocketState>) {
  _state = { ..._state, ...patch };
  _listeners.forEach((fn) => fn(_state));
}

// ---------------------------------------------------------------------------
// Public imperative API (safe to call from Phaser / plain TS)
// ---------------------------------------------------------------------------

/**
 * Initialise the shared socket.  Call this once before Phaser boots.
 * Reads `bm_token` from localStorage and connects to `NEXT_PUBLIC_WS_URL`.
 * Subsequent calls are no-ops if the socket is already connected.
 */
export function initSocket(): Socket {
  if (_socket) return _socket;

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (!wsUrl) {
    console.error("[SocketContext] NEXT_PUBLIC_WS_URL is not set");
  }

  const token =
    typeof window !== "undefined" ? localStorage.getItem("bm_token") : null;

  const socket = io(wsUrl ?? "", {
    auth: { token: token ?? "" },
    transports: ["websocket", "polling"],
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
  });

  socket.on("connect", () => {
    console.log("[SocketContext] connected");
    _setState({ connected: true, error: null });
  });

  socket.on("connect_error", (err) => {
    console.error("[SocketContext] connection error:", err.message);
    _setState({ connected: false, error: err.message });

    // AUTH errors are terminal — the server rejected the handshake and will
    // not retry. Socket.IO sets socket.active=false on middleware errors, so
    // auto-reconnect is already dead. We destroy the socket here so callers
    // (WSSyncManager) see a null socket and can route to login cleanly.
    if (
      err.message === "AUTH_MISSING_TOKEN" ||
      err.message === "AUTH_INVALID_TOKEN"
    ) {
      destroySocket();
    }
  });

  socket.on("disconnect", (reason) => {
    console.warn("[SocketContext] disconnected:", reason);
    _setState({ connected: false, error: null });
  });

  _socket = socket;
  return socket;
}

/**
 * Return the active socket instance (or null if not yet initialised).
 * Phaser scenes call this directly instead of using React hooks.
 */
export function getSocket(): Socket | null {
  return _socket;
}

/** Alias kept for back-compat with WSSyncManager import patterns. */
export const getSharedSocket = getSocket;

/**
 * Fully tear down the shared socket.  Called by PhaserGame on unmount.
 * Also called when the server sends a REPLACED_BY_NEW_TAB error.
 */
export function destroySocket(): void {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
  _setState({ connected: false, error: null });
}

/** Subscribe to connection-state changes (used by the React context). */
export function subscribeSocketState(fn: (s: SocketState) => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Read the current connection state snapshot (synchronous). */
export function getSocketState(): SocketState {
  return _state;
}

// ---------------------------------------------------------------------------
// React context
// ---------------------------------------------------------------------------

/**
 * React context value.  Consumed by `useSocket()` and `useSocketState()`.
 * The Provider is mounted in `app/game/layout.tsx` (or the DynamicGameShell)
 * so every game-route component can read it without prop-drilling.
 */
export interface SocketContextValue {
  /** The raw Socket.IO instance — may be null before `initSocket()` runs. */
  socket: Socket | null;
  /** Live connection state (updates trigger a React re-render). */
  state: SocketState;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  state: { connected: false, error: null },
});

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Returns the raw Socket.IO instance.
 * Use sparingly — prefer `useSocketState()` for read-only status.
 */
export function useSocket(): Socket | null {
  return useContext(SocketContext).socket;
}

/**
 * Returns live `{ connected, error }` state.
 * Components that only care about connectivity (overlays, status chips)
 * should use this hook so they don't re-render on every socket event.
 */
export function useSocketState(): SocketState {
  return useContext(SocketContext).state;
}

// ---------------------------------------------------------------------------
// SocketProvider
// ---------------------------------------------------------------------------

/**
 * Wrap `app/game/layout.tsx` with this provider so every game-route component
 * can read socket state without prop-drilling.
 *
 * It does NOT call `initSocket()` — that is the responsibility of `PhaserGame`
 * so the socket is only opened when the game actually mounts.  The provider
 * simply subscribes to module-level state changes and surfaces them via context.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SocketState>(getSocketState);

  useEffect(() => {
    // Sync with any state that may have changed before this component mounted.
    setState(getSocketState());
    return subscribeSocketState(setState);
  }, []);

  const value: SocketContextValue = {
    socket: _socket,
    state,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

"use client";

/**
 * useGameSettings
 *
 * Persists and exposes two in-game display preferences:
 *   - zoom  (1 | 2 | 3 | 4)  — camera zoom level; default 4 on desktop, 2 on mobile
 *   - rotated (boolean)       — whether the phaser container is rotated 90° CW
 *
 * Values are kept in localStorage so they survive page refreshes.
 * Zoom changes are also dispatched as a "phaser-set-zoom" window event so
 * FarmScene can call cam.setZoom() without a full game restart.
 */

import { create } from "zustand";
import { detectMobile } from "@/lib/detectMobile";

export type ZoomLevel = 1 | 2 | 3 | 4;

const LS_ZOOM_KEY    = "lf_game_zoom";
const LS_ROTATE_KEY  = "lf_game_rotated";

function defaultZoom(): ZoomLevel {
  if (typeof window === "undefined") return 4;
  const stored = localStorage.getItem(LS_ZOOM_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (n >= 1 && n <= 4) return n as ZoomLevel;
  }
  return detectMobile() ? 2 : 4;
}

function defaultRotated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_ROTATE_KEY) === "true";
}

interface GameSettingsState {
  zoom:        ZoomLevel;
  rotated:     boolean;
  setZoom:     (z: ZoomLevel) => void;
  setRotated:  (r: boolean)   => void;
}

export const useGameSettings = create<GameSettingsState>((set) => ({
  zoom:    4,   // overridden on first client render in PhaserCanvas
  rotated: false,

  setZoom: (z) => {
    localStorage.setItem(LS_ZOOM_KEY, String(z));
    window.dispatchEvent(new CustomEvent("phaser-set-zoom", { detail: { zoom: z } }));
    set({ zoom: z });
  },

  setRotated: (r) => {
    localStorage.setItem(LS_ROTATE_KEY, String(r));
    set({ rotated: r });
  },
}));

/** Call once on the client to hydrate from localStorage. */
export function hydratGameSettings() {
  useGameSettings.setState({
    zoom:    defaultZoom(),
    rotated: defaultRotated(),
  });
}

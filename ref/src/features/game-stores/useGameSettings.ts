

/**
 * useGameSettings
 *
 * Persists and exposes in-game display preferences:
 *   - zoom  (2.5 | 3 | 3.5 | 4)  — camera zoom level; default 4 on desktop, 2.5 on mobile
 *
 * Values are kept in localStorage so they survive page refreshes.
 * Zoom changes are also dispatched as a "phaser-set-zoom" window event so
 * FarmScene can call cam.setZoom() without a full game restart.
 */

import { create } from "zustand";
import { detectMobile } from "@/features/utils/detect-mobile";

export type ZoomLevel = 2.5 | 3 | 3.5 | 4;

export const ZOOM_LEVELS: ZoomLevel[] = [2.5, 3, 3.5, 4];

const LS_ZOOM_KEY = "lf_game_zoom";

function defaultZoom(): ZoomLevel {
  if (typeof window === "undefined") return 4;
  const stored = localStorage.getItem(LS_ZOOM_KEY);
  if (stored) {
    const n = parseFloat(stored);
    if ((ZOOM_LEVELS as number[]).includes(n)) return n as ZoomLevel;
  }
  return detectMobile() ? 2.5 : 4;
}

interface GameSettingsState {
  zoom:    ZoomLevel;
  setZoom: (z: ZoomLevel) => void;
}

export const useGameSettings = create<GameSettingsState>((set) => ({
  zoom: 4,   // overridden on first client render via hydratGameSettings()

  setZoom: (z) => {
    localStorage.setItem(LS_ZOOM_KEY, String(z));
    window.dispatchEvent(new CustomEvent("phaser-set-zoom", { detail: { zoom: z } }));
    set({ zoom: z });
  },
}));

/** Call once on the client to hydrate from localStorage. */
export function hydratGameSettings() {
  useGameSettings.setState({ zoom: defaultZoom() });
}

/**
 * lib/config/buildings.ts
 *
 * Central config for every Lucky Frog building on the map.
 * Set `enabled: false` on any building to intercept its click in
 * PhaserModals and show a BuildingStatusModal instead of the real
 * modal. Use this for maintenance windows or "coming soon" features
 * without touching modal or Phaser scene code.
 *
 * disabledMode:
 *   "coming-soon"  — feature is planned but not ready
 *   "maintenance"  — temporarily unavailable
 *   "hidden"       — do not open any modal at all (silent)
 */

export type DisabledMode = "coming-soon" | "maintenance" | "hidden";

export interface BuildingConfig {
  /** Display name shown in modals and status screens */
  displayName: string;
  /** Whether clicking the building opens its real modal */
  enabled: boolean;
  /** What to show when enabled is false */
  disabledMode?: DisabledMode;
}

export const BUILDING_CONFIG: Record<string, BuildingConfig> = {
  // ── Lucky Frog buildings ───────────────────────────────────────────────────
  summoning_shrine: {
    displayName: "Summoning Shrine",
    enabled: false,
    disabledMode: "coming-soon",
  },
  hall_of_fame: {
    displayName: "Hall of Fame",
    enabled: false,
    disabledMode: "coming-soon",
  },

  // ── Hearthvale buildings ───────────────────────────────────────────────────
  house: {
    displayName: "House",
    enabled: true,
  },
  bank: {
    displayName: "Bank",
    enabled: true,
  },
  market: {
    displayName: "Market",
    enabled: true,
  },
  blacksmith: {
    displayName: "Blacksmith",
    enabled: true,
  },
  kitchen: {
    displayName: "Kitchen",
    enabled: true,
  },
  barn: {
    displayName: "Barn",
    enabled: true,
  },
};

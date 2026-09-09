/**
 * lib/modules/farms/types.server.ts
 *
 * Pure TypeScript types for the `farms` domain.
 */

import type { Document } from "mongoose";

// ---------------------------------------------------------------------------
// Embedded sub-types
// ---------------------------------------------------------------------------

/**
 * A crop plot. Planted crops wait here until harvested.
 * Growth starts only after the player waters the plot (isWatered = true).
 * Readiness is computed as: isWatered && Date.now() >= wateredAt + growthMs.
 */
export interface FieldNode {
  /** Crop name, e.g. "Potato". */
  name: string;
  /** Unix timestamp (ms) when this plot was planted. 0 = empty. */
  plantedAt: number;
  /**
   * Unix timestamp (ms) when the player watered this plot.
   * Set by the water action. Undefined until watered.
   */
  wateredAt?: number;
  /**
   * Whether this plot has been watered. Growth timer only starts once true.
   */
  isWatered?: boolean;
}

/**
 * An animal slot. Identified by slot index (0–9 for chickens, 0–4 for cows/sheep).
 */
export interface AnimalNode {
  /** "Chicken" | "Cow" | "Sheep" */
  type: string;
  /** Unix timestamp (ms) of last feeding. undefined = never fed. */
  fedAt?: number;
}

// ---------------------------------------------------------------------------
// Main document interface
// ---------------------------------------------------------------------------

export interface IFarm extends Document {
  /** Wallet address of the owning player. */
  playerId: string;

  createdAt: Date;
  updatedAt: Date;

  /**
   * Farm expansion level (1–10). Default 1.
   * Incremented via the "farm.upgrade" action.
   * Moved here from the player document — level is a property of the farm, not the player.
   */
  level: number;

  /** Current stamina (0–100). Gating resource for chop/mine actions. */
  stamina: number;
  /** Unix timestamp (ms) of last stamina regen tick. */
  staminaRegenAt: number;

  // Crop fields — 30 plots, keyed "0"–"29". Empty slots are absent.
  fields: Record<string, FieldNode>;

  // Animals — keyed by slot index string.
  chickens: Record<string, AnimalNode>;
  cows:     Record<string, AnimalNode>;
  sheep:    Record<string, AnimalNode>;
}

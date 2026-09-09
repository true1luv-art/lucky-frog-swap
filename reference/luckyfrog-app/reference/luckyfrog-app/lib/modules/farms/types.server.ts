/**
 * lib/modules/farms/types.server.ts
 *
 * Pure TypeScript types for the `farms` domain.
 * No mongoose runtime code — only string unions and interfaces live here.
 * Consumed by model.server.ts and any external code that needs the shape
 * without importing the Mongoose model.
 */

import type { Document } from "mongoose";
import type { EmbeddedQuest } from "@/shared/types/quests";

// ---------------------------------------------------------------------------
// Embedded sub-types
// ---------------------------------------------------------------------------

/**
 * A crop plot. Planted crops wait here until harvested.
 * `plantedAt` is a Unix ms timestamp set at plant time. §5.4
 */
export interface FieldNode {
  /** Crop name, e.g. "Potato". */
  name: string;
  /** Unix timestamp (ms) when this plot was planted. 0 = empty. */
  plantedAt: number;
}

/**
 * A permanent resource node (tree, stone, iron, gold).
 * The node regenerates after `harvestedAt + recoverySeconds * 1000`. §5.6
 */
export interface ResourceNode {
  /** Resource name: "Wood" | "Stone" | "Iron" | "Gold". */
  name: string;
  /** Unix timestamp (ms) of the last successful harvest. undefined = never harvested. */
  harvestedAt?: number;
  /** Base drop amount before skill bonus multiplication. */
  amount: number;
}

/**
 * An animal slot. Animals are identified by their slot index (0–9 for chickens,
 * 0–4 for cows/sheep). §2.4-A / §2.4-B
 */
export interface AnimalNode {
  /** "Chicken" | "Cow" | "Sheep" */
  type: string;
  /** Unix timestamp (ms) of last feeding. undefined = never fed / hungry. */
  fedAt?: number;
  /** Produce yield multiplier (1 normally, >1 with husbandry bonus). */
  multiplier: number;
}

/**
 * Fishing state for the farm. §2.4-C
 */
export interface FishingState {
  /** Unix timestamp (ms) of the last successful cast. 0 = never cast. */
  lastCastAt: number;
  /** Effective cooldown captured when the last cast was created. */
  cooldownMs?: number;
  /** Name of the last caught fish, or null. */
  lastCaughtFish: string | null;
  /** Amount caught on the last cast. */
  lastCaughtAmount: number;
  /** Lifetime cast counter. */
  totalCasts: number;
  /** Lifetime catch counter (successful). */
  totalCaught: number;
}

/**
 * One cooking slot. null when kitchen is idle. §2.4-D
 */
export interface CookingSlot {
  /** Food item name, e.g. "Roasted Potato". */
  item: string;
  /** Unix timestamp (ms) when cooking started. */
  startedAt: number;
  /** Effective cook duration (ms), already adjusted for cooking skill bonus. */
  duration: number;
}

/**
 * Stamina state. Regenerates 5 % of max per hour, capped at 8 offline intervals. §2.3-D
 */
export interface StaminaState {
  /** Current stamina points. */
  current: number;
  /** Maximum stamina (100 in Phase 2; future: may scale with stats). */
  max: number;
  /** Unix timestamp (ms) of the last regen calculation. */
  lastRegenAt: number;
}

// ---------------------------------------------------------------------------
// Main document interface
// ---------------------------------------------------------------------------

export interface IFarm extends Document {
  /** Wallet address of the owning player. §5.3 */
  playerId: string;

  createdAt: Date;
  updatedAt: Date;

  // Crop fields — 30 plots, keyed "0"–"29". Empty slots are absent from the map. §5.4 / §5.5
  fields: Record<string, FieldNode>;

  // Resource nodes — keyed by index string. §5.6
  trees:  Record<string, ResourceNode>;
  stones: Record<string, ResourceNode>;
  iron:   Record<string, ResourceNode>;
  gold:   Record<string, ResourceNode>;

  // Animals — keyed by slot index string. §2.4-A / §2.4-B
  chickens: Record<string, AnimalNode>;
  cows:     Record<string, AnimalNode>;
  sheep:    Record<string, AnimalNode>;

  // Activities
  fishing:  FishingState;
  cooking:  CookingSlot | null;
  stamina:  StaminaState;

  // Embedded quests — lazy-refreshed on every farm read. §fold-quests
  quests: {
    daily:  EmbeddedQuest[];
    weekly: EmbeddedQuest[];
  };

  // Lifetime counters — used for achievement tracking. §2.5-C
  activity:     Record<string, number>;
  achievements: Record<string, number>;
}

/**
 * Shared game types used by both client and server code.
 *
 * This file MUST remain free of any Node.js-only imports (mongoose, mongodb,
 * node-schedule, etc.) so it can be safely imported by client components.
 */

// ---------------------------------------------------------------------------
// Frogs
// ---------------------------------------------------------------------------

export interface MintedFrogAttributes {
  mining: number;
  luck: number;
  dodge: number;
  crit: number;
  damage: number;
  defense: number;
}

export interface MintedFrog {
  /** MongoDB ObjectId of the frogs document — serialized as a hex string. */
  _id: string;
  item_number: number;
  cardId: string;
  name: string;
  image?: string;
  attributes: MintedFrogAttributes;
}

/**
 * lib/modules/equipments/types.server.ts
 *
 * Pure TypeScript types for the `equipments` domain.
 * No mongoose runtime code — only string unions, interfaces, and the Document
 * interface live here. Consumed by model.server.ts and any external code that
 * needs the shape without importing the Mongoose model.
 */

import type { Document } from "mongoose";

// ---------------------------------------------------------------------------
// String unions
// ---------------------------------------------------------------------------

/**
 * Equipment slot — determines where a piece of equipment can be worn.
 * §C5 — Canonical slots: weapon | armor | mount | accessory | special.
 *
 * `avatar` has been removed. `special` is added for unique/seasonal items
 * that do not fit the four primary combat slots.
 */
export type EquipmentSlot =
  | "weapon"
  | "armor"
  | "mount"
  | "accessory"
  | "special";

// ---------------------------------------------------------------------------
// Sub-document interfaces
// ---------------------------------------------------------------------------

/** Stat bonuses granted when equipment is equipped. All values are additive. */
export interface EquipmentStats {
  mining?:  number;
  luck?:    number;
  dodge?:   number;
  crit?:    number;
  damage?:  number;
  defense?: number;
}

/**
 * Embedded market sub-document on the Equipment document. §4.1-B
 *
 * Always present on the document (never null). When the equipment is not
 * listed, `listed` is false and all nullable fields are at their defaults.
 * Mirrors the Egg/Frog market embed shape for uniform querying.
 *
 * `seller` is redundant with `owner` and exists purely as a safety check
 * during settlement to catch races where ownership changed mid-listing.
 */
export interface EquipmentMarket {
  /** True while this equipment is actively listed on the marketplace. */
  listed:  boolean;
  /** Asking price in Game Balance (off-chain LFRG). */
  price:   number;
  /** Wallet address of the player who listed this equipment. Null when not listed. */
  seller:  string | null;
  /** When the listing was created. Null when not listed. */
  created: Date | null;
  /** When the listing expires and becomes invalid. Null when not listed. */
  expires: Date | null;
  /** True once a buyer has settled this listing. */
  sold:    boolean;
  /**
   * Short unique hash used as the on-chain purchase memo (`tm_purchase-<hash>`).
   * Public listing identity — the settlement monitor resolves listings by
   * scanning tradable collections for a matching `market.hash`. See hash.ts.
   */
  hash?:   string;
  /**
   * Purchase-settlement concurrency lock. Set true while a purchase is being
   * settled to prevent concurrent buys. Stale locks are stolen after
   * `MARKETPLACE_CONFIG.lockTimeoutMs`. §9.20
   */
  locked?: boolean;
  /** When the concurrency lock was acquired. */
  lockedAt?: Date;
}

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface IEquipment extends Document {
  /**
   * Sequential mint number for this equipment piece. Unique across the
   * collection — mirrors `item_number` on frogs and eggs for consistent
   * cross-asset identification and display.
   */
  item_number: number;
  /** Player wallet address — matches players.wallet. */
  owner: string;
  /** Display name of the equipment piece. e.g. "Iron Pickaxe", "Miner's Helm" */
  name: string;
  /** Equipment category / slot. */
  slot: EquipmentSlot;
  /** Stat bonuses granted by this equipment piece. */
  stats: EquipmentStats;
  /** Level of this equipment piece (1–10). Matches frog level conventions. */
  level: number;
  /** Image URL or asset path for displaying this item. */
  image: string;
  /** True when this equipment is currently equipped by the owner. */
  equipped: boolean;
  /**
   * Embedded market listing state. Always present — never null.
   * When not listed: listed=false, price=0, seller=null, etc.
   * Reset to defaults on purchase or cancellation. §4.1-B
   */
  market: EquipmentMarket;
  createdAt: Date;
  updatedAt: Date;
}

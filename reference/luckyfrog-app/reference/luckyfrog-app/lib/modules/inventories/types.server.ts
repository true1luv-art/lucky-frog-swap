/**
 * lib/modules/inventories/types.server.ts
 *
 * Pure TypeScript types for the `inventories` domain.
 * No mongoose runtime code lives here. Consumed by model.server.ts and any
 * external code that needs these shapes without importing the Mongoose model.
 */

import type { Document } from "mongoose";

// ---------------------------------------------------------------------------
// Sub-document interfaces — marketplace reservation §9.7, §4.1-C
// ---------------------------------------------------------------------------

/**
 * Embedded market reservation on a stackable inventory item. §9.7, §4.1-C
 *
 * When a player lists N units of an item, `amount` units are moved out of the
 * document's usable `amount` and into `market.amount` (reserved quantity).
 * The two are always kept in sync atomically. One active listing per item
 * per player. §4.2-B
 */
export interface InventoryItemMarket {
  /** True while this item has an active listing. */
  listed:  boolean;
  /** Quantity currently reserved for sale (not usable by the player). */
  amount:  number;
  /** Price per unit in Game Balance (unclaimed LFRG). */
  price:   number;
  /** Wallet address of the player who listed this item. */
  seller:  string;
  /** When the listing was created. */
  created: Date;
  /** When the listing expires and becomes invalid. */
  expires: Date;
  /** True once a buyer has settled this listing. */
  sold:    boolean;
  /**
   * Short unique hash used as the on-chain purchase memo (`buy_item_{hash}`).
   * The public listing identity now that the marketplace_listings index has
   * been removed. Optional for backward compatibility with reservations
   * written before on-chain purchases.
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
// Document interface — one document per (owner, item) §9.24
// ---------------------------------------------------------------------------

export interface IInventoryItem extends Document {
  /** Wallet address — matches players.wallet (and frogs/eggs `owner`). */
  owner: string;

  /**
   * Canonical item name / key, e.g. "Potato Seed", "Iron Ore", "frogment",
   * "rare_shard". Unique per owner (compound index { owner, item }).
   */
  item: string;

  /**
   * USABLE quantity (non-negative integer). Reserved-for-sale quantity lives
   * in `market.amount` and is excluded from this figure by design. §9.7
   */
  amount: number;

  /**
   * Embedded marketplace listing state for this stackable item. §9.7
   * Null when the item is not listed. Set to null on sale/cancellation.
   */
  market: InventoryItemMarket | null;

  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Aggregate view
// ---------------------------------------------------------------------------

/**
 * Aggregated, backward-compatible view of a player's whole inventory.
 * Produced by `getInventory()` from the per-item documents so existing
 * consumers that read `inv.items[name]` / `inv.balance` keep working.
 */
export interface AggregatedInventory {
  /** Wallet address (kept as `playerId` for backward compatibility). */
  playerId: string;
  /** item name → usable quantity. */
  items: Record<string, number>;
  /** item name → active market reservation (only items currently listed). */
  marketReservations: Record<string, InventoryItemMarket>;
  /** Game Balance = live unclaimed mined LFRG (players.lfrg accrued). */
  balance: number;
}

/**
 * Backward-compatible alias. Historically `IInventory` was the whole-player
 * inventory shape (`items` map + `marketReservations` + `balance`). That is now
 * the aggregate produced by `getInventory()`, so consumers that read the whole
 * inventory keep the same field access. New per-item code should use
 * `IInventoryItem`.
 */
export type IInventory = AggregatedInventory;

// ---------------------------------------------------------------------------
// Pure helper — usable quantity §9.7
// ---------------------------------------------------------------------------

/**
 * Returns the usable (non-reserved) quantity of an item document.
 * Always reads `amount` — market reservations are excluded by design. §9.7
 */
export function getUsableAmount(doc: { amount?: number } | null | undefined): number {
  return doc?.amount ?? 0;
}

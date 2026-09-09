/**
 * lib/modules/items/types.server.ts
 *
 * Pure TypeScript types for the `items` domain.
 * Replaces lib/modules/inventories/types.server.ts.
 *
 * ONE DOCUMENT PER (owner, item). `amount` is the USABLE quantity.
 * Units reserved for sale are deducted from `amount` at list time.
 *
 * `type` categorises the item for UI grouping, API filtering, and
 * future item-type-gated actions (e.g. only `seed` items can be planted).
 */

import type { Document, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Item category — used for UI grouping and type-gated actions
// ---------------------------------------------------------------------------

/** Tuple used for Mongoose enum validation on the `type` field. */
export const ITEM_TYPES = [
  "seed", "crop", "resource", "ingot", "fish",
  "food", "produce", "animal", "currency",
] as const;

/**
 * Item type registry — maps canonical item names to their category
 */
export type ItemType =
  | "seed"
  | "crop"
  | "resource"
  | "ingot"
  | "fish"
  | "food"
  | "produce"
  | "animal"
  | "currency";

// ---------------------------------------------------------------------------
// Sub-document — lightweight market back-reference §redesign §4
// ---------------------------------------------------------------------------

/**
 * UI-hint sub-document written when a player lists an item.
 * Null when the item is not listed.
 *
 * This is READ-ONLY for all game systems. `listings` is always the source of
 * truth. `market.amount` is updated on partial fills and cleared on full sale
 * or cancellation.
 *
 * Rules:
 *   List:         amount -= qty;  market = { id, amount: qty }
 *   Cancel:       amount += listing.quantity;  market = null
 *   Full sale:    market = null
 *   Partial fill: market.amount -= purchaseQty
 */
export interface ItemMarket {
  /** _id of the active listing document. */
  id:     Types.ObjectId;
  /** Units currently out on the market (display only). */
  amount: number;
}

/**
 * Backward-compatible alias (used in older marketplace event code).
 */
export type InventoryItemMarket = ItemMarket;

// ---------------------------------------------------------------------------
// Document interface — one document per (owner, item) §9.24
// ---------------------------------------------------------------------------

export interface IItem extends Document {
  /** Wallet address — matches players.wallet. */
  owner: string;

  /**
   * Canonical item name / key, e.g. "Potato Seed", "Iron Ore".
   * Unique per owner (compound index { owner, item }).
   */
  item: string;

  /**
   * Item category. Required. Used for UI grouping, type-gated actions,
   * and marketplace filtering.
   */
  type: ItemType;

  /**
   * USABLE quantity (non-negative integer). The quantity reserved for sale is
   * deducted from `amount` at list time — it is never kept separately. §9.7
   */
  amount: number;

  /**
   * Lightweight back-reference to the active listing for this item.
   * Null when the item is not listed. Read-only UI hint — never used for
   * validation. §redesign §4
   */
  market: ItemMarket | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Backward-compatible alias used by older event code.
 */
export type IInventoryItem = IItem;

// ---------------------------------------------------------------------------
// Aggregate view
// ---------------------------------------------------------------------------

/**
 * Aggregated, backward-compatible view of a player's whole item collection.
 */
export interface AggregatedInventory {
  /** Wallet address (kept as `playerId` for backward compatibility). */
  playerId: string;
  /** item name → usable quantity. */
  items: Record<string, number>;
  /** item name → active market back-reference (only items currently listed). */
  marketReservations: Record<string, ItemMarket>;
  /** Game Balance = persisted in-game coins (players.coins). */
  balance: number;
}

/**
 * Backward-compatible alias.
 */
export type IInventory = AggregatedInventory;

// ---------------------------------------------------------------------------
// Item type registry — maps canonical item names to their category
// ---------------------------------------------------------------------------

export const ITEM_TYPE_MAP: Record<string, ItemType> = {
  // Seeds
  "Potato Seed":   "seed",
  "Carrot Seed":   "seed",
  "Pumpkin Seed":  "seed",
  "Cabbage Seed":  "seed",
  "Wheat Seed":    "seed",
  "Beetroot Seed": "seed",
  "Parsnip Seed":  "seed",
  "Radish Seed":   "seed",

  // Crops
  Potato:   "crop",
  Carrot:   "crop",
  Pumpkin:  "crop",
  Cabbage:  "crop",
  Wheat:    "crop",
  Beetroot: "crop",
  Parsnip:  "crop",
  Radish:   "crop",

  // Resources
  Wood:   "resource",
  Stone:  "resource",
  Iron:   "resource",
  Silver: "resource",
  Emerald:"resource",
  Diamond:"resource",
  Ignisite:"resource",
  Coal:   "resource",

  // Ingots
  "Iron Ingot":     "ingot",
  "Silver Ingot":   "ingot",
  "Emerald Ingot":  "ingot",
  "Diamond Ingot":  "ingot",
  "Ignisite Ingot": "ingot",

  // Fish
  Fish:   "fish",
  Salmon: "fish",
  Tuna:   "fish",
  Lobster:"fish",

  // Food
  "Cabbage Roll": "food",
  "Pumpkin Soup": "food",
  "Carrot Cake":  "food",
  "Fish Stew":    "food",

  // Produce
  Egg:  "produce",
  Milk: "produce",
  Wool: "produce",

  // Animals
  Chicken: "animal",
  Cow:     "animal",
  Sheep:   "animal",

  // Currency
  Gold:  "currency",
  Shard: "currency",
};

/**
 * Returns the ItemType for a given item name, defaulting to "resource"
 * if the name is not in the registry.
 */
export function getItemType(itemName: string): ItemType {
  return ITEM_TYPE_MAP[itemName] ?? "resource";
}

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

/**
 * Returns the usable quantity of an item document.
 */
export function getUsableAmount(doc: { amount?: number } | null | undefined): number {
  return doc?.amount ?? 0;
}

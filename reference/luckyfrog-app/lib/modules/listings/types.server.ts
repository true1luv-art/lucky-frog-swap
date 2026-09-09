/**
 * lib/modules/listings/types.server.ts
 *
 * Pure TypeScript types for the `listings` collection.
 * No Mongoose runtime code lives here.
 */

import type { Document, Types } from "mongoose";

/** Lifecycle state of a listing document. */
export type ListingStatus = "active" | "sold" | "cancelled";

export interface IListing extends Document {
  /** Reference to the seller's Player document (_id). Populate to get wallet + username. */
  seller: Types.ObjectId;

  /** Canonical item name, e.g. "Iron Ore". */
  item: string;

  /** Asset type — matches TRADABLE_ASSET_TYPES. */
  assetType: string;

  /**
   * Units currently available. Decrements on partial fills.
   * Zero only after a full sale (at which point status = "sold").
   */
  quantity: number;

  /** Per-unit price in Game Balance. */
  price: number;

  /** Lifecycle state. */
  status: ListingStatus;

  /** Fee collected on sale (0 until sold). */
  fee: number;

  /** Seller proceeds (0 until sold). */
  sellerNet: number;

  /** Wallet of the buyer (null until sold). */
  buyerId: string | null;

  /** When the listing was created. */
  createdAt: Date;

  /** When status became terminal (null while active). */
  completedAt: Date | null;

  /**
   * Optimistic purchase lock.
   * Set when a player starts the buy flow; auto-expires after 10 minutes.
   * Other players see the listing as "locked" during this window.
   */
  lockedBy:    string | null;
  lockedAt:    Date   | null;
  lockedUntil: Date   | null;
}

/** Lightweight shape returned by the repository browse / find operations. */
export interface ListingDoc {
  _id: Types.ObjectId;
  /** ObjectId ref to players._id. Use .toString() to compare or populate for wallet/username. */
  seller: Types.ObjectId;
  item: string;
  assetType: string;
  quantity: number;
  price: number;
  status: ListingStatus;
  fee: number;
  sellerNet: number;
  buyerId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  lockedBy:    string | null;
  lockedAt:    Date   | null;
  lockedUntil: Date   | null;
}

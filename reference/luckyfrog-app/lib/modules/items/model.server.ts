/**
 * lib/modules/items/model.server.ts
 *
 * MongoDB schema for the `items` collection.
 * Replaces lib/modules/inventories/model.server.ts.
 *
 * ONE DOCUMENT PER (owner, item). `amount` is the USABLE quantity.
 * `type` categorises the item for UI grouping and type-gated actions.
 *
 * State transitions for the `market` sub-document:
 *   List:         amount -= qty;  market = { id, amount: qty }
 *   Cancel:       amount += listing.quantity;  market = null
 *   Full sale:    market = null
 *   Partial fill: market.amount -= purchaseQty
 */

import mongoose, { Schema, Model, Types } from "mongoose";
import type { ItemMarket, IItem, AggregatedInventory, IInventory } from "./types.server";
import { ITEM_TYPES } from "./types.server";

// Re-export types so callers can import from a single path.
export type { ItemMarket, IItem, AggregatedInventory, IInventory } from "./types.server";
export type { IInventoryItem, InventoryItemMarket } from "./types.server";
export { getUsableAmount } from "./types.server";

// ---------------------------------------------------------------------------
// Sub-schema — market back-reference
// ---------------------------------------------------------------------------

const ItemMarketSchema = new Schema<ItemMarket>(
  {
    id:     { type: Types.ObjectId, required: true, ref: "listings" },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Schema — one document per (owner, item)
// ---------------------------------------------------------------------------

const ItemSchema = new Schema<IItem>(
  {
    owner:  { type: String,  required: true, index: true },
    item:   { type: String,  required: true },
    type:   { type: String,  required: true, enum: ITEM_TYPES, index: true },
    amount: { type: Number,  required: true, default: 0 },
    market: { type: ItemMarketSchema, default: null },
  },
  {
    collection: "items",
    timestamps: true,
  },
);

// Unique per (owner, item) — enables atomic upserts keyed by the pair.
ItemSchema.index({ owner: 1, item: 1 }, { unique: true });
// Secondary index for type-filtered queries (e.g. GET /api/items?type=seed).
ItemSchema.index({ owner: 1, type: 1 });

export const ItemModel: Model<IItem> =
  mongoose.models.Item ??
  mongoose.model<IItem>("Item", ItemSchema);

/**
 * Backward-compatible alias — existing code that imports `InventoryModel`
 * will work without changes once the import path is updated to items/.
 */
export const InventoryModel = ItemModel;

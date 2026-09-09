/**
 * lib/modules/inventories/model.server.ts
 *
 * MongoDB schema for the `inventories` collection. §2.1-B, GDD §9.24
 *
 * ONE DOCUMENT PER ITEM. Each inventory item is its own document — mirroring
 * the `eggs` / `frogs` collections (an `owner` field + item data + an embedded
 * `market` sub-document). This replaces the previous single-document-per-player
 * shape (`{ playerId, items: Map, marketReservations: Map, balance }`).
 *
 * Why per-item docs (GDD §8.44 Rule 10 + §9.24):
 *   - Every tradable asset embeds its own marketplace state (`market`).
 *   - Uniform shape across frogs / eggs / inventory items.
 *   - Atomic per-item updates avoid whole-document contention.
 *
 * Game Balance (the coins used to buy/sell in the farm + marketplace) is NOT
 * stored here. It is persisted on the player as `players.lfrg`. See
 * repository.server.ts addBalance/deductBalance. GDD §9.3 / §9.4.
 *
 * Reservation mechanic (GDD §9.7):
 *   Before listing:  { item:"Iron Ore", amount:250, market:null }
 *   Player lists 100: amount -= 100, market = { listed:true, amount:100, ... }
 *   After listing:   { item:"Iron Ore", amount:150, market:{ amount:100 } }
 *   Usable quantity for game actions = `amount` (never counts market.amount).
 *   On sale:   market.amount -= soldQty; when 0 → market = null.
 *   On cancel: amount += market.amount; market = null.
 *
 * Reference: docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.7, §9.24
 *            docs/implementation_plans/phase-04-marketplace.md §4.1-C
 */

import mongoose, { Schema, Model } from "mongoose";
import type { InventoryItemMarket, IInventoryItem, AggregatedInventory, IInventory } from "./types.server";

export type { InventoryItemMarket, IInventoryItem, AggregatedInventory, IInventory } from "./types.server";
export { getUsableAmount } from "./types.server";

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/**
 * Schema for the embedded marketplace reservation. §9.7, §4.1-C
 * The item document stores `market` as a nullable field — null = not listed.
 */
const InventoryItemMarketSchema = new Schema<InventoryItemMarket>(
  {
    listed:  { type: Boolean, required: true },
    amount:  { type: Number,  required: true },
    price:   { type: Number,  required: true },
    seller:  { type: String,  required: true },
    created: { type: Date,    required: true },
    expires: { type: Date,    required: true },
    sold:    { type: Boolean, required: true, default: false },
    hash:    { type: String,  required: false },
    locked:  { type: Boolean, required: false, default: false },
    lockedAt:{ type: Date,    required: false, default: undefined },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Schema — one document per item §9.24
// ---------------------------------------------------------------------------

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    owner:  { type: String, required: true, index: true },
    item:   { type: String, required: true },
    amount: { type: Number, required: true, default: 0 },
    // null = not listed; populated only while the item is on the marketplace. §9.7
    market: { type: InventoryItemMarketSchema, default: null },
  },
  {
    collection: "inventories",
    timestamps: true,
  },
);

// One document per (owner, item). Enables atomic upserts keyed by the pair.
InventoryItemSchema.index({ owner: 1, item: 1 }, { unique: true });
// Fast lookup of active listings for the marketplace browse/expiry sweeps.
InventoryItemSchema.index({ "market.listed": 1 });
// Purchase-memo lookup: the settlement monitor resolves a listing by its hash.
InventoryItemSchema.index({ "market.hash": 1 });

export const InventoryModel: Model<IInventoryItem> =
  mongoose.models.Inventory ??
  mongoose.model<IInventoryItem>("Inventory", InventoryItemSchema);

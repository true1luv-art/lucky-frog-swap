/**
 * lib/modules/marketplace-logs/model.server.ts
 *
 * MongoDB schema for the `marketplace_logs` collection — the single, unified
 * history/audit log for marketplace settlement and listing lifecycle events.
 * A `market_sale` records a player buying another player's listing; the market
 * wallet keeps `fee` and forwards `sellerNet` to the seller.
 *
 * This collection replaces the former `marketplace_history` collection. It is
 * the ONLY history collection (per the smart-contract refactor plan): there is
 * no separate listings index — live listings live embedded on the asset
 * documents (`collectibles` / `frogs` / `equipment` / `inventories`).
 *
 * IMMUTABLE — records are NEVER modified after creation.
 *
 * Consumed by:
 *   - price history endpoint — average/median price per day.
 *   - "My Listings" earnings breakdown — seller net per trade.
 *   - treasury / analytics / suspicious-activity dashboards.
 *
 * Reference: docs/implementation_plans/luckfrog-smart-contract-refactor.md (Phase 2)
 */

import mongoose, { Schema, Model } from "mongoose";
import type { MarketplaceLogType, IMarketplaceLog } from "./types.server";

export type { MarketplaceLogType, IMarketplaceLog } from "./types.server";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const MarketplaceLogSchema = new Schema<IMarketplaceLog>(
  {
    type: {
      type: String,
      required: true,
      default: "market_sale",
      enum: ["market_sale", "listing_cancelled", "listing_expired"],
    },

    listingId:   { type: String, required: false },

    assetType:   { type: String, required: true },
    assetId:     { type: String, required: true },
    assetName:   { type: String, required: true },

    sellerId:    { type: String, required: false },
    // Buyer is absent for lifecycle records (listing_cancelled / listing_expired).
    buyerId:     { type: String, required: false },

    // Amounts default to 0 for lifecycle records (no money moved).
    quantity:    { type: Number, required: true, default: 1 },
    price:       { type: Number, required: true, default: 0 },
    totalPrice:  { type: Number, required: true, default: 0 },
    fee:         { type: Number, required: true, default: 0 },
    sellerNet:   { type: Number, required: true, default: 0 },

    completedAt: { type: Date,   required: true },
    signature:   { type: String, required: false },
    txHash:      { type: String, required: false },
  },
  {
    collection: "marketplace_logs",
    // Disable automatic `updatedAt` — log records are immutable.
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

/** Primary sort: most recent trades first (price history endpoint). */
MarketplaceLogSchema.index({ completedAt: -1 });

/** Filter by activity type, most-recent-first. */
MarketplaceLogSchema.index({ type: 1, completedAt: -1 });

/** Seller history lookup: "My Listings" earnings breakdown. */
MarketplaceLogSchema.index({ sellerId: 1 });

/** Buyer history lookup: trade history from the buyer's perspective. */
MarketplaceLogSchema.index({ buyerId: 1 });

/** Per-asset price history: price trend per item type + time. */
MarketplaceLogSchema.index({ assetType: 1, assetName: 1, completedAt: -1 });

/**
 * Durable idempotency guard for the watcher: at most one log per buyer payment
 * signature. Sparse so legacy records without a signature don't collide.
 */
MarketplaceLogSchema.index({ signature: 1 }, { unique: true, sparse: true });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const MarketplaceLogModel: Model<IMarketplaceLog> =
  mongoose.models.MarketplaceLog ??
  mongoose.model<IMarketplaceLog>("MarketplaceLog", MarketplaceLogSchema);

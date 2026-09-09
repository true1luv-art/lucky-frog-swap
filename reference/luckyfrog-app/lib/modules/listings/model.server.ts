/**
 * lib/modules/listings/model.server.ts
 *
 * Mongoose model for the `listings` collection.
 *
 * One document = one listing. The document persists in a terminal status
 * after the listing is sold or cancelled, making it the permanent record
 * (marketplace_logs is no longer needed).
 *
 * `_id` is the listing identity throughout the system — no separate hash field.
 * No `locked`/`lockedAt` — the cron consumer serialises purchases.
 * No `expiresAt`         — listings have no expiration.
 */

import mongoose, { Schema, Model, Types } from "mongoose";
import type { IListing } from "./types.server";

export type { IListing, ListingDoc, ListingStatus } from "./types.server";

const ListingSchema = new Schema<IListing>(
  {
    seller:      { type: Types.ObjectId, ref: "Player", required: true },
    item:        { type: String, required: true },
    assetType:   { type: String, required: true },
    quantity:    { type: Number, required: true },
    price:       { type: Number, required: true },
    status: {
      type:    String,
      enum:    ["active", "sold", "cancelled"],
      required: true,
      default: "active",
    },
    fee:         { type: Number, required: true, default: 0 },
    sellerNet:   { type: Number, required: true, default: 0 },
    buyerId:     { type: String, default: null },
    completedAt: { type: Date,   default: null },
    // Optimistic purchase lock — set when a player starts buying, expires after 10 min.
    lockedBy:    { type: String, default: null },
    lockedAt:    { type: Date,   default: null },
    lockedUntil: { type: Date,   default: null },
  },
  {
    collection: "listings",
    timestamps: true,
  },
);

// ---------------------------------------------------------------------------
// Indexes (plan §3)
// ---------------------------------------------------------------------------

// Browse with item filter
ListingSchema.index({ status: 1, assetType: 1, item: 1, price: 1 });
// Browse without item filter
ListingSchema.index({ status: 1, assetType: 1, price: 1 });
// "My Listings"
ListingSchema.index({ seller: 1, status: 1, createdAt: -1 });
// Active listing cap check
ListingSchema.index({ seller: 1, status: 1 });
// Price history per asset
ListingSchema.index({ status: 1, item: 1, completedAt: -1 });
// Analytics / activity feed
ListingSchema.index({ status: 1, completedAt: -1 });
// Buyer purchase history
ListingSchema.index({ buyerId: 1, status: 1 });
// Expired lock cleanup query (sparse — most docs have null lockedUntil)
ListingSchema.index({ lockedUntil: 1 }, { sparse: true });

export const ListingModel: Model<IListing> =
  mongoose.models.Listing ??
  mongoose.model<IListing>("Listing", ListingSchema);

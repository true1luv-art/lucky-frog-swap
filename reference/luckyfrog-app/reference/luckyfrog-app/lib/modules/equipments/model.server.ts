/**
 * lib/modules/equipments/model.server.ts
 *
 * MongoDB schema for the `equipments` collection. §4.1-B
 *
 * Equipment is tradeable in Generation One (GDD §9.3). Each equipment piece
 * belongs to exactly one player and can be listed on the marketplace.
 *
 * While `market.listed === true` the equipment is locked:
 *   - Cannot be equipped, modified, or re-listed.
 * On purchase or cancellation the market sub-document is reset to its empty
 * defaults (listed: false, sold: false, etc.) — it is NEVER set to null, so
 * the shape of the embed is always present for consistent querying.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.1-B
 *            docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.3, §9.7
 */

import mongoose, { Schema, Model } from "mongoose";
import type { EquipmentSlot, EquipmentStats, EquipmentMarket, IEquipment } from "./types.server";

export type { EquipmentSlot, EquipmentStats, EquipmentMarket, IEquipment } from "./types.server";

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const EquipmentStatsSchema = new Schema<EquipmentStats>(
  {
    mining:  { type: Number, default: 0 },
    luck:    { type: Number, default: 0 },
    dodge:   { type: Number, default: 0 },
    crit:    { type: Number, default: 0 },
    damage:  { type: Number, default: 0 },
    defense: { type: Number, default: 0 },
  },
  { _id: false },
);

/**
 * Schema for the embedded market sub-document. §4.1-B
 * Always present on the parent document — never null. Nullable fields use
 * `default: null` so the shape is always fully hydrated.
 */
const EquipmentMarketSchema = new Schema<EquipmentMarket>(
  {
    listed:   { type: Boolean, default: false },
    price:    { type: Number,  default: 0 },
    seller:   { type: String,  default: null },
    created:  { type: Date,    default: null },
    expires:  { type: Date,    default: null },
    sold:     { type: Boolean, default: false },
    hash:     { type: String,  required: false },
    locked:   { type: Boolean, required: false, default: false },
    lockedAt: { type: Date,    required: false, default: undefined },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Main schema
// ---------------------------------------------------------------------------

const EquipmentSchema = new Schema<IEquipment>(
  {
    item_number: { type: Number, required: true, unique: true, index: true },
    owner:    { type: String, required: true, index: true },
    name:     { type: String, required: true },
    slot:     {
      type: String,
      enum: ["weapon", "armor", "mount", "accessory", "special"],
      required: true,
    },
    stats:    { type: EquipmentStatsSchema, default: () => ({}) },
    level:    { type: Number, default: 1 },
    image:    { type: String, default: "" },
    equipped: { type: Boolean, default: false },
    // Always present — never null. Reset to defaults on purchase/cancellation. §4.1-B
    market:   { type: EquipmentMarketSchema, default: () => ({}) },
  },
  {
    collection: "equipments",
    timestamps: true,
  },
);

// Compound index for browsing a player's equipped items quickly.
EquipmentSchema.index({ owner: 1, slot: 1 });
// Index for finding all listed equipment (marketplace browse).
EquipmentSchema.index({ "market.listed": 1, "market.price": 1 });
// Purchase-memo lookup: the settlement monitor resolves a listing by its hash.
EquipmentSchema.index({ "market.hash": 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const EquipmentModel: Model<IEquipment> =
  mongoose.models.Equipment ??
  mongoose.model<IEquipment>("Equipment", EquipmentSchema);

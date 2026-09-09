/**
 * lib/modules/tools/model.server.ts
 *
 * MongoDB schema for the `tools` collection.
 *
 * ONE DOCUMENT PER TOOL INSTANCE, keyed by `owner` (wallet) and `toolId`.
 * Pattern mirrors lib/modules/items/ — never embed tool instances in
 * the farm or player document.
 *
 * Indexes:
 *   { owner: 1 }              — "get all tools for player" (hot path)
 *   { owner: 1, toolId: 1 }  unique — stable upsert key for durability updates
 */

import mongoose, { Schema, Model } from "mongoose";
import type { IToolInstance } from "./types.server";

export type { IToolInstance } from "./types.server";

const ToolInstanceSchema = new Schema<IToolInstance>(
  {
    owner:         { type: String, required: true, index: true },
    toolId:        { type: String, required: true },
    name:          { type: String, required: true },
    tier:          { type: String, required: true },
    durability:    { type: Number, default: null },
    maxDurability: { type: Number, default: null },
  },
  {
    collection: "tools",
    timestamps: true,
  },
);

// Compound unique index: one document per (owner, toolId).
ToolInstanceSchema.index({ owner: 1, toolId: 1 }, { unique: true });

export const ToolInstanceModel: Model<IToolInstance> =
  mongoose.models.Tool ??
  mongoose.model<IToolInstance>("Tool", ToolInstanceSchema);

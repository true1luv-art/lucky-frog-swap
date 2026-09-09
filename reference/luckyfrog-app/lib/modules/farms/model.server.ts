/**
 * lib/modules/farms/model.server.ts
 *
 * MongoDB schema for the `farms` collection.
 *
 * The farm stores only world-state that is directly tied to a physical location
 * on the map: crop plots and animal slots. Everything else has moved:
 *
 *   tools      → lib/modules/tools/       (one doc per tool instance, keyed by owner)
 *   quests     → lib/modules/players/     (embedded on the player document)
 *   fishing    → removed (no cooldown needed with fast respawn)
 *   resource node maps (trees/stones/iron/…) → removed (fast respawn, no harvestedAt)
 *
 * Skills and balances live on the `players` document, NOT here.
 */

import mongoose, { Schema, Model } from "mongoose";
import type { FieldNode, AnimalNode, IFarm } from "./types.server";

export type { FieldNode, AnimalNode, IFarm } from "./types.server";

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const FieldNodeSchema = new Schema<FieldNode>(
  {
    name:      { type: String, required: true },
    plantedAt: { type: Number, default: 0 },
    /** Unix timestamp (ms) when the player watered this plot. */
    wateredAt: { type: Number },
    /** True once the plot has been watered; growth timer starts at this point. */
    isWatered: { type: Boolean, default: false },
  },
  { _id: false },
);

const AnimalNodeSchema = new Schema<AnimalNode>(
  {
    type:  { type: String, required: true },
    fedAt: { type: Number },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Main schema
// ---------------------------------------------------------------------------

const FarmSchema = new Schema<IFarm>(
  {
    playerId: { type: String, required: true, unique: true, index: true },

    // Farm expansion level (1–10). Moved from the player document.
    level: { type: Number, default: 1 },

    // Stamina — action energy that gates chopping and mining. Regens over time.
    stamina:       { type: Number, default: 100 },
    staminaRegenAt: { type: Number, default: 0 },

    // Crop plots — up to 30 slots, keyed "0"–"29". Empty slots are absent.
    fields: { type: Map, of: FieldNodeSchema, default: {} },

    // Animals — keyed by slot index string.
    chickens: { type: Map, of: AnimalNodeSchema, default: {} },
    cows:     { type: Map, of: AnimalNodeSchema, default: {} },
    sheep:    { type: Map, of: AnimalNodeSchema, default: {} },
  },
  {
    collection: "farms",
    timestamps: true,
  },
);

FarmSchema.index({ updatedAt: -1 });

export const FarmModel: Model<IFarm> =
  mongoose.models.Farm ?? mongoose.model<IFarm>("Farm", FarmSchema);

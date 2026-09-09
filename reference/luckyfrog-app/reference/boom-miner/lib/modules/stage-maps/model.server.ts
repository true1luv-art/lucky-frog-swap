import mongoose, { Schema, Model } from "mongoose";
import type { IStageMap, MapNode } from "./types.server";

export type { IStageMap, MapNode, NodeKind } from "./types.server";

const MapNodeSchema = new Schema<MapNode>(
  {
    x:         { type: Number, required: true },
    y:         { type: Number, required: true },
    kind:      { type: String, enum: ["chest", "bush"], required: true },
    rarity:    { type: String },
    maxHp:     { type: Number, required: true },
    hp:        { type: Number, required: true },
    coins:     { type: Number, required: true },
    destroyed: { type: Boolean, default: false },
  },
  { _id: false },
);

const StageMapSchema = new Schema<IStageMap>(
  {
    playerId:      { type: String, required: true, unique: true, index: true },
    stage:         { type: Number, default: 1 },
    seed:          { type: Number, required: true },
    width:         { type: Number, required: true },
    height:        { type: Number, required: true },
    nodes:         { type: Map, of: MapNodeSchema, default: {} },
    totalChests:   { type: Number, default: 0 },
    clearedChests: { type: Number, default: 0 },
    /** Monotonic hit counter; written on every 30 s flush. See Phase B/D. */
    mapVersion:    { type: Number, default: 0 },
    /** Unix-ms of the last accepted mine:hit committed to the DB. */
    lastActionAt:  { type: Number, default: 0 },
  },
  {
    collection: "stage_maps",
    timestamps: true,
  },
);

export const StageMapModel: Model<IStageMap> =
  mongoose.models.StageMap ?? mongoose.model<IStageMap>("StageMap", StageMapSchema);

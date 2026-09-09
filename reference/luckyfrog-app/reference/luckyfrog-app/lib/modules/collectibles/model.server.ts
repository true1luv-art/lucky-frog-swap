import mongoose, { Model, Schema } from "mongoose";
import { COLLECTIBLE_NAMES } from "@/shared/types/gameplay/collectibles";
import type {
  CollectibleMarket,
  ICollectible,
  ICollectibleCounter,
} from "./types.server";

const CollectibleMarketSchema = new Schema<CollectibleMarket>(
  {
    listed: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    seller: { type: String, default: null },
    created: { type: Date, default: null },
    expires: { type: Date, default: null },
    sold: { type: Boolean, default: false },
    hash: { type: String, required: false },
    locked: { type: Boolean, required: false, default: false },
    lockedAt: { type: Date, required: false, default: undefined },
  },
  { _id: false },
);

const CollectibleSchema = new Schema<ICollectible>(
  {
    collectible_number: { type: Number, required: true, min: 1, max: 1500 },
    owner: { type: String, required: true, index: true, trim: true },
    name: { type: String, enum: COLLECTIBLE_NAMES, required: true },
    system: {
      type: String,
      enum: ["harvesting", "trees", "fishing", "mining", "cooking", "husbandry"],
      required: true,
    },
    image: { type: String, required: true },
    market: { type: CollectibleMarketSchema, default: () => ({}) },
  },
  { collection: "collectibles", timestamps: true },
);

CollectibleSchema.index({ name: 1, collectible_number: 1 }, { unique: true });
CollectibleSchema.index({ owner: 1, name: 1 });
CollectibleSchema.index({ "market.listed": 1, "market.price": 1 });
CollectibleSchema.index({ "market.hash": 1 });

const CollectibleCounterSchema = new Schema<ICollectibleCounter>(
  {
    name: { type: String, enum: COLLECTIBLE_NAMES, required: true, unique: true },
    mintedSupply: { type: Number, required: true, default: 0, min: 0, max: 1500 },
    maxSupply: { type: Number, required: true, default: 1500, min: 1500, max: 1500 },
  },
  { collection: "collectible_counters", timestamps: true },
);

export const CollectibleModel: Model<ICollectible> =
  mongoose.models.Collectible ??
  mongoose.model<ICollectible>("Collectible", CollectibleSchema);

export const CollectibleCounterModel: Model<ICollectibleCounter> =
  mongoose.models.CollectibleCounter ??
  mongoose.model<ICollectibleCounter>("CollectibleCounter", CollectibleCounterSchema);

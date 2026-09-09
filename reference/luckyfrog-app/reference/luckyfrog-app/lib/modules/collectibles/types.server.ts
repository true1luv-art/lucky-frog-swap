import type { Document } from "mongoose";
import type {
  CollectibleName,
  CollectibleSystem,
} from "@/shared/types/gameplay/collectibles";

export interface CollectibleMarket {
  listed: boolean;
  price: number;
  seller: string | null;
  created: Date | null;
  expires: Date | null;
  sold: boolean;
  hash?: string;
  locked?: boolean;
  lockedAt?: Date;
}

export interface ICollectible extends Document {
  collectible_number: number;
  owner: string;
  name: CollectibleName;
  system: CollectibleSystem;
  image: string;
  market: CollectibleMarket;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICollectibleCounter extends Document {
  name: CollectibleName;
  mintedSupply: number;
  maxSupply: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectibleSupply {
  name: CollectibleName;
  mintedSupply: number;
  maxSupply: number;
  remainingSupply: number;
}

export interface CollectibleNumberRange {
  first: number;
  last: number;
}

export type CollectibleMintReservation = CollectibleNumberRange;

export const EMPTY_COLLECTIBLE_MARKET: CollectibleMarket = {
  listed: false,
  price: 0,
  seller: null,
  created: null,
  expires: null,
  sold: false,
  locked: false,
};

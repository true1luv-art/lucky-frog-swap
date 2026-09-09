import type { ClientSession } from "mongoose";
import { connectDatabase } from "@/lib/config/database";
import {
  COLLECTIBLE_MAX_SUPPLY,
  COLLECTIBLES,
} from "@/shared/data/collectibles";
import {
  COLLECTIBLE_NAMES,
  type CollectibleName,
} from "@/shared/types/gameplay/collectibles";
import {
  CollectibleCounterModel,
  CollectibleModel,
} from "./model.server";
import {
  EMPTY_COLLECTIBLE_MARKET,
  type CollectibleMarket,
  type CollectibleMintReservation,
  type CollectibleSupply,
  type ICollectible,
} from "./types.server";

type FilterQuery = Record<string, unknown>;

function normalizeOwner(owner: string): string {
  const normalized = owner.trim();
  if (!normalized) throw new Error("Collectible owner is required");
  return normalized;
}

function assertQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Collectible quantity must be a positive integer");
  }
}

function toSupply(
  name: CollectibleName,
  mintedSupply: number,
  maxSupply: number = COLLECTIBLE_MAX_SUPPLY,
): CollectibleSupply {
  return {
    name,
    mintedSupply,
    maxSupply,
    remainingSupply: Math.max(0, maxSupply - mintedSupply),
  };
}

export async function getCollectibleById(id: string): Promise<ICollectible | null> {
  await connectDatabase();
  return CollectibleModel.findById(id).lean<ICollectible>();
}

export async function getCollectiblesByOwner(owner: string): Promise<ICollectible[]> {
  await connectDatabase();
  return CollectibleModel.find({ owner: normalizeOwner(owner) })
    .sort({ name: 1, collectible_number: 1 })
    .lean<ICollectible[]>();
}

export async function getOwnedCollectibleNames(
  owner: string,
): Promise<CollectibleName[]> {
  await connectDatabase();
  const documents = await CollectibleModel.find({ owner: normalizeOwner(owner) })
    .select({ name: 1, _id: 0 })
    .lean<Array<{ name: CollectibleName }>>();
  const owned = new Set(documents.map((document) => document.name));
  return COLLECTIBLE_NAMES.filter((name) => owned.has(name));
}

export async function getCollectibleSupply(
  name: CollectibleName,
): Promise<CollectibleSupply> {
  await connectDatabase();
  const counter = await CollectibleCounterModel.findOne({ name }).lean<{
    mintedSupply: number;
    maxSupply: number;
  }>();
  return toSupply(name, counter?.mintedSupply ?? 0, counter?.maxSupply);
}

export async function getAllCollectibleSupplies(): Promise<CollectibleSupply[]> {
  await connectDatabase();
  const counters = await CollectibleCounterModel.find({}).lean<
    Array<{ name: CollectibleName; mintedSupply: number; maxSupply: number }>
  >();
  const byName = new Map(counters.map((counter) => [counter.name, counter]));
  return COLLECTIBLE_NAMES.map((name) => {
    const counter = byName.get(name);
    return toSupply(name, counter?.mintedSupply ?? 0, counter?.maxSupply);
  });
}

export async function getListedCollectibles(): Promise<ICollectible[]> {
  await connectDatabase();
  return CollectibleModel.find({ "market.listed": true, "market.sold": { $ne: true } })
    .sort({ "market.created": -1 })
    .lean<ICollectible[]>();
}

/**
 * Reserves a per-name mint-number range in the supplied transaction. The
 * caller must use the same session for inserts and inventory deductions so
 * transaction conflicts retry and an abort rolls every mutation back.
 */
export async function reserveCollectibleMintRange(
  name: CollectibleName,
  quantity: number,
  session: ClientSession,
): Promise<CollectibleMintReservation> {
  assertQuantity(quantity);
  await connectDatabase();

  await CollectibleCounterModel.updateOne(
    { name },
    { $setOnInsert: { name, mintedSupply: 0, maxSupply: COLLECTIBLE_MAX_SUPPLY } },
    { upsert: true, session },
  );

  const counter = await CollectibleCounterModel.findOneAndUpdate(
    {
      name,
      maxSupply: COLLECTIBLE_MAX_SUPPLY,
      mintedSupply: { $lte: COLLECTIBLE_MAX_SUPPLY - quantity },
    },
    { $inc: { mintedSupply: quantity } },
    { new: true, session },
  );

  if (!counter) throw new Error(`${name} is sold out`);

  return {
    first: counter.mintedSupply - quantity + 1,
    last: counter.mintedSupply,
  };
}

export async function insertReservedCollectibles(
  owner: string,
  name: CollectibleName,
  reservation: CollectibleMintReservation,
  session: ClientSession,
): Promise<ICollectible[]> {
  await connectDatabase();
  const normalizedOwner = normalizeOwner(owner);
  const quantity = reservation.last - reservation.first + 1;
  if (quantity <= 0) throw new Error("Invalid collectible mint reservation");

  const definition = COLLECTIBLES[name];
  const documents = Array.from({ length: quantity }, (_, index) => ({
    collectible_number: reservation.first + index,
    owner: normalizedOwner,
    name,
    system: definition.system,
    image: definition.image,
    market: { ...EMPTY_COLLECTIBLE_MARKET },
  }));

  return CollectibleModel.insertMany(documents, { session });
}

export async function updateCollectibleMarket(
  collectibleId: string,
  owner: string,
  market: CollectibleMarket,
  session?: ClientSession,
): Promise<boolean> {
  await connectDatabase();
  const result = await CollectibleModel.updateOne(
    { _id: collectibleId, owner: normalizeOwner(owner) } as FilterQuery,
    { $set: { market } },
    { session },
  );
  return result.modifiedCount === 1;
}

export async function settleCollectibleMarketplaceSale(
  collectibleId: string,
  seller: string,
  buyer: string,
  session: ClientSession,
): Promise<boolean> {
  await connectDatabase();
  const result = await CollectibleModel.updateOne(
    {
      _id: collectibleId,
      owner: normalizeOwner(seller),
      "market.listed": true,
      "market.locked": true,
    } as FilterQuery,
    {
      $set: {
        owner: normalizeOwner(buyer),
        market: { ...EMPTY_COLLECTIBLE_MARKET },
      },
    },
    { session },
  );
  return result.modifiedCount === 1;
}

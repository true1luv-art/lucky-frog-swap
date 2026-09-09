/**
 * lib/modules/items/repository.server.ts
 *
 * Data-access layer for the `items` collection.
 * Replaces lib/modules/inventories/repository.server.ts.
 *
 * Storage is ONE DOCUMENT PER ITEM (`{ owner, item, type, amount, market }`).
 * The read API (`getOrCreateInventory`) still returns an aggregated
 * `{ playerId, items, marketReservations, balance }` view so existing
 * consumers are unchanged.
 *
 * All item mutations use atomic MongoDB operators keyed on { owner, item } to
 * prevent race conditions and keep quantities non-negative at the DB level.
 *
 * The `type` field is set on upsert via `getItemType(name)` — it is never
 * changed after insert because an item's category is invariant.
 */

import mongoose from "mongoose";
import { ItemModel } from "@/lib/modules/items/model.server";
import type { IItem, AggregatedInventory, ItemMarket } from "@/lib/modules/items/types.server";
import { getItemType } from "@/lib/modules/items/types.server";
import { PlayerModel } from "@/lib/modules/players/model.server";
import { connectDatabase } from "@/lib/config/database";

// ---------------------------------------------------------------------------
// Starter items for new players
// ---------------------------------------------------------------------------

// New players start with no items — they purchase seeds from the Market.
const INITIAL_ITEMS: Record<string, number> = {};

// ---------------------------------------------------------------------------
// Internal aggregate helper
// ---------------------------------------------------------------------------

function aggregate(
  playerId: string,
  docs: IItem[],
  balance: number,
): AggregatedInventory {
  const items: Record<string, number> = {};
  const marketReservations: Record<string, ItemMarket> = {};
  for (const doc of docs) {
    items[doc.item] = doc.amount;
    if (doc.market) {
      marketReservations[doc.item] = doc.market;
    }
  }
  return { playerId, items, marketReservations, balance };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns the aggregated item collection for `playerId`, or null if the player
 * does not exist.
 */
export async function getInventory(playerId: string): Promise<AggregatedInventory | null> {
  await connectDatabase();
  const [docs, player] = await Promise.all([
    ItemModel.find({ owner: playerId }).lean<IItem[]>(),
    getPlayerForBalance(playerId),
  ]);
  if (!player) return null;
  return aggregate(playerId, docs ?? [], player.coins ?? 0);
}

/**
 * Returns the aggregated item collection for `playerId`, seeding the starter
 * set if no documents exist yet.
 */
export async function getOrCreateInventory(playerId: string): Promise<AggregatedInventory> {
  await connectDatabase();
  const count = await ItemModel.countDocuments({ owner: playerId });
  if (count === 0) {
    await createInitialInventory(playerId);
  }
  const player  = await getPlayerForBalance(playerId);
  const balance = player?.coins ?? 0;
  const docs    = await ItemModel.find({ owner: playerId }).lean<IItem[]>();
  return aggregate(playerId, docs ?? [], balance);
}

/**
 * Seeds the initial item documents for a new player. Idempotent via upserts.
 */
export async function createInitialInventory(playerId: string): Promise<AggregatedInventory> {
  await connectDatabase();
  const entries = Object.entries(INITIAL_ITEMS);
  if (entries.length > 0) {
    await ItemModel.bulkWrite(
      entries.map(([name, amount]) => ({
        updateOne: {
          filter: { owner: playerId, item: name },
          update: {
            $setOnInsert: {
              owner:  playerId,
              item:   name,
              type:   getItemType(name),
              amount,
              market: null,
            },
          },
          upsert: true,
        },
      })),
    );
  }
  const player  = await getPlayerForBalance(playerId);
  const balance = player?.coins ?? 0;
  const docs    = await ItemModel.find({ owner: playerId }).lean<IItem[]>();
  return aggregate(playerId, docs ?? [], balance);
}

// ---------------------------------------------------------------------------
// Mutations — all atomic, keyed on { owner, item }
// ---------------------------------------------------------------------------

/**
 * Atomically increments item quantities. Upserts each item document.
 * Sets `type` on insert via `getItemType`.
 */
export async function addItems(
  playerId: string,
  items: Record<string, number>,
): Promise<void> {
  await connectDatabase();
  if (Object.keys(items).length === 0) return;
  await ItemModel.bulkWrite(
    Object.entries(items).map(([name, qty]) => ({
      updateOne: {
        filter: { owner: playerId, item: name },
        update: {
          $inc: { amount: qty },
          $setOnInsert: { owner: playerId, item: name, type: getItemType(name), market: null },
        },
        upsert: true,
      },
    })),
  );
}

/** Convenience wrapper — adds a single item. */
export async function addInventoryItem(
  playerId: string,
  itemName: string,
  qty: number,
): Promise<void> {
  await addItems(playerId, { [itemName]: qty });
}

/**
 * Atomically deducts item quantities, clamping each item's `amount` to 0.
 */
export async function deductItems(
  playerId: string,
  items: Record<string, number>,
): Promise<void> {
  await connectDatabase();
  if (Object.keys(items).length === 0) return;
  await ItemModel.bulkWrite(
    Object.entries(items).map(([name, qty]) => ({
      updateOne: {
        filter: { owner: playerId, item: name },
        update: [
          {
            $set: {
              amount: {
                $max: [0, { $subtract: [{ $ifNull: ["$amount", 0] }, qty] }],
              },
            },
          },
        ],
        upsert: true,
      },
    })),
  );
}

/** Convenience wrapper — deducts a single item. */
export async function deductInventoryItem(
  playerId: string,
  itemName: string,
  qty: number,
): Promise<void> {
  await deductItems(playerId, { [itemName]: qty });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Returns true if `playerId` has at least the specified usable quantity of
 * each item. Reservation quantities are excluded.
 */
export async function hasItems(
  playerId: string,
  items: Record<string, number>,
): Promise<boolean> {
  await connectDatabase();
  const names = Object.keys(items);
  if (names.length === 0) return true;
  const docs = await ItemModel
    .find({ owner: playerId, item: { $in: names } })
    .lean<IItem[]>();
  const held: Record<string, number> = {};
  for (const doc of docs) held[doc.item] = doc.amount;
  for (const [name, qty] of Object.entries(items)) {
    if ((held[name] ?? 0) < qty) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Balance helpers (coins live on the player document)
// ---------------------------------------------------------------------------

export async function setPlayerBalance(playerId: string, newCoins: number): Promise<void> {
  await connectDatabase();
  await PlayerModel.updateOne(
    { wallet: playerId },
    { $set: { coins: Math.max(0, newCoins) } },
  );
}

export async function getPlayerForBalance(playerId: string): Promise<{ coins: number } | null> {
  await connectDatabase();
  return PlayerModel.findOne({ wallet: playerId }, { coins: 1 }).lean<{ coins: number }>();
}

/**
 * Deletes all item documents for `playerId`. Used in tests and migration endpoints.
 */
export async function deleteInventory(playerId: string): Promise<void> {
  await connectDatabase();
  await ItemModel.deleteMany({ owner: playerId });
}

// ---------------------------------------------------------------------------
// Marketplace back-reference ops §redesign §4
// ---------------------------------------------------------------------------

/**
 * Writes the market back-reference and atomically deducts `quantity` from `amount`.
 */
export async function setMarketBackRef(
  owner:     string,
  item:      string,
  listingId: mongoose.Types.ObjectId,
  quantity:  number,
): Promise<void> {
  await connectDatabase();
  await ItemModel.updateOne(
    { owner, item, amount: { $gte: quantity } },
    {
      $inc: { amount: -quantity },
      $set: { market: { id: listingId, amount: quantity } },
    },
  );
}

/**
 * Decrements `market.amount` for a partial fill.
 */
export async function decrementMarketAmount(
  owner:       string,
  item:        string,
  purchaseQty: number,
): Promise<void> {
  await connectDatabase();
  await ItemModel.updateOne(
    { owner, item, "market.amount": { $gte: purchaseQty } },
    { $inc: { "market.amount": -purchaseQty } },
  );
}

/**
 * Clears the market back-reference. On cancellation also restores `quantity`
 * units to `amount`.
 */
export async function clearMarketBackRef(
  owner:      string,
  item:       string,
  returnQty?: number,
): Promise<void> {
  await connectDatabase();
  const update: Record<string, unknown> = { $set: { market: null } };
  if (returnQty && returnQty > 0) {
    update.$inc = { amount: returnQty };
  }
  await ItemModel.updateOne({ owner, item }, update);
}

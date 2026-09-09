/**
 * lib/modules/inventories/repository.server.ts
 *
 * Data-access layer for the `inventories` collection. §2.1-B, GDD §9.24
 *
 * Storage is ONE DOCUMENT PER ITEM (`{ owner, item, amount, market }`), but the
 * read API (`getInventory`) still returns an aggregated `{ playerId, items,
 * marketReservations, balance }` view so existing consumers are unchanged.
 *
 * Game Balance is the player's persisted LFRG (`players.lfrg`). Balance
 * mutations (addBalance / deductBalance) live in service.server.ts. The
 * repository owns the raw setPlayerBalance primitive. GDD §9.3 / §9.4.
 *
 * All item mutations use atomic MongoDB operators keyed on { owner, item } to
 * prevent race conditions and keep quantities non-negative at the DB level.
 *
 * Reference: docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.7, §9.24
 *            docs/implementation_plans/phase-02-farming-backend.md §2.1-B
 */

import { InventoryModel } from "@/lib/modules/inventories/model.server";
import type {
  IInventoryItem,
  AggregatedInventory,
  InventoryItemMarket,
} from "@/lib/modules/inventories/types.server";
import { PlayerModel } from "@/lib/modules/players/model.server";
import { connectDatabase } from "@/lib/config/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Starter inventory for a new player. Intentionally EMPTY — new accounts begin
 * with no items and no balance. §2.1-D
 */
const INITIAL_ITEMS: Record<string, number> = {};

/**
 * Reduces the per-item documents for `playerId` into the aggregate shape.
 * `balance` is filled in by the caller (needs a player read).
 */
function aggregate(
  playerId: string,
  docs: IInventoryItem[],
  balance: number,
): AggregatedInventory {
  const items: Record<string, number> = {};
  const marketReservations: Record<string, InventoryItemMarket> = {};
  for (const doc of docs) {
    items[doc.item] = doc.amount;
    if (doc.market && doc.market.listed) {
      marketReservations[doc.item] = doc.market;
    }
  }
  return { playerId, items, marketReservations, balance };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns the aggregated inventory for `playerId`, or null if the player does
 * not exist. Item docs are reduced into `{ items, marketReservations }` and
 * `balance` is the persisted LFRG game balance. §9.24
 */
export async function getInventory(playerId: string): Promise<AggregatedInventory | null> {
  await connectDatabase();
  const [docs, player] = await Promise.all([
    InventoryModel.find({ owner: playerId }).lean<IInventoryItem[]>(),
    getPlayerForBalance(playerId),
  ]);
  // No player → treat as no inventory (mirrors previous null-on-missing).
  if (!player) return null;
  return aggregate(playerId, docs ?? [], player.lfrg ?? 0);
}

/**
 * Returns the aggregated inventory for `playerId`, creating the starter set of
 * per-item documents if none exist yet. §2.1-B
 */
export async function getOrCreateInventory(playerId: string): Promise<AggregatedInventory> {
  await connectDatabase();
  const count = await InventoryModel.countDocuments({ owner: playerId });
  if (count === 0) {
    await createInitialInventory(playerId);
  }
  const player = await getPlayerForBalance(playerId);
  const balance = player?.lfrg ?? 0;
  const docs = await InventoryModel.find({ owner: playerId }).lean<IInventoryItem[]>();
  return aggregate(playerId, docs ?? [], balance);
}

/**
 * Creates the initial inventory documents for a new player — one document per
 * starter item. Idempotent via per-item upserts. §2.1-D
 */
export async function createInitialInventory(playerId: string): Promise<AggregatedInventory> {
  await connectDatabase();
  const entries = Object.entries(INITIAL_ITEMS);
  // bulkWrite throws on an empty op list; with an empty starter set there is
  // simply nothing to seed, so skip the write entirely.
  if (entries.length > 0) {
    await InventoryModel.bulkWrite(
      entries.map(([item, amount]) => ({
        updateOne: {
          filter: { owner: playerId, item },
          update: { $setOnInsert: { owner: playerId, item, amount, market: null } },
          upsert: true,
        },
      })),
    );
  }
  const player = await getPlayerForBalance(playerId);
  const balance = player?.lfrg ?? 0;
  const docs = await InventoryModel.find({ owner: playerId }).lean<IInventoryItem[]>();
  return aggregate(playerId, docs ?? [], balance);
}

// ---------------------------------------------------------------------------
// Item mutations — all atomic, keyed on { owner, item } §2.1-B, §9.24
// ---------------------------------------------------------------------------

/**
 * Atomically increments item quantities. Upserts each item document.
 *
 * @param items  Item name → positive integer quantity to add.
 */
export async function addItems(
  playerId: string,
  items: Record<string, number>,
): Promise<void> {
  await connectDatabase();
  if (Object.keys(items).length === 0) return;
  await InventoryModel.bulkWrite(
    Object.entries(items).map(([item, qty]) => ({
      updateOne: {
        filter: { owner: playerId, item },
        update: {
          $inc: { amount: qty },
          $setOnInsert: { owner: playerId, item, market: null },
        },
        upsert: true,
      },
    })),
  );
}

/**
 * Atomically increments a SINGLE item's quantity. §C7
 * Convenience wrapper around `addItems`.
 */
export async function addInventoryItem(
  playerId: string,
  itemName: string,
  qty: number,
): Promise<void> {
  await addItems(playerId, { [itemName]: qty });
}

/**
 * Atomically deducts a SINGLE item's quantity, clamped to a minimum of 0. §C7
 * Convenience wrapper around `deductItems`.
 */
export async function deductInventoryItem(
  playerId: string,
  itemName: string,
  qty: number,
): Promise<void> {
  await deductItems(playerId, { [itemName]: qty });
}

/**
 * Atomically deducts item quantities, clamping each item's `amount` to a
 * minimum of 0 with an aggregation-pipeline `$max`.
 *
 * @param items  Item name → positive integer quantity to deduct.
 */
export async function deductItems(
  playerId: string,
  items: Record<string, number>,
): Promise<void> {
  await connectDatabase();
  if (Object.keys(items).length === 0) return;
  await InventoryModel.bulkWrite(
    Object.entries(items).map(([item, qty]) => ({
      updateOne: {
        filter: { owner: playerId, item },
        // Pipeline update so we can clamp to 0 in a single atomic op.
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

// ---------------------------------------------------------------------------
// Validation §2.1-B
// ---------------------------------------------------------------------------

/**
 * Returns true if `playerId` has at least the specified USABLE quantity of each
 * item. Reservation quantities (`market.amount`) are excluded by design. §9.7
 */
export async function hasItems(
  playerId: string,
  items: Record<string, number>,
): Promise<boolean> {
  await connectDatabase();
  const names = Object.keys(items);
  if (names.length === 0) return true;
  const docs = await InventoryModel
    .find({ owner: playerId, item: { $in: names } })
    .lean<IInventoryItem[]>();
  const held: Record<string, number> = {};
  for (const doc of docs) held[doc.item] = doc.amount;
  for (const [name, qty] of Object.entries(items)) {
    if ((held[name] ?? 0) < qty) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Balance mutations — LFRG-backed §9.3 / §9.4
// ---------------------------------------------------------------------------

/**
 * Raw primitive: writes the pre-computed `lfrg` value.
 *
 * Callers (service layer) are responsible for reading the persisted balance,
 * applying the delta, clamping to 0, and passing the final value here. Never
 * call this directly outside of the service.
 */
export async function setPlayerBalance(
  playerId: string,
  newLfrg: number,
): Promise<void> {
  await connectDatabase();
  await PlayerModel.updateOne(
    { wallet: playerId },
    { $set: { lfrg: Math.max(0, newLfrg) } },
  );
}

/**
 * Returns the player's persisted game balance.
 */
export async function getPlayerForBalance(playerId: string): Promise<{
  lfrg: number;
} | null> {
  await connectDatabase();
  return PlayerModel.findOne({ wallet: playerId }, { lfrg: 1 }).lean<{
    lfrg: number;
  }>();
}

/**
 * Deletes all inventory documents for `playerId`.
 * Used in tests and the migration endpoint. §2.5-E
 */
export async function deleteInventory(playerId: string): Promise<void> {
  await connectDatabase();
  await InventoryModel.deleteMany({ owner: playerId });
}

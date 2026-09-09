/**
 * lib/events/list-asset/list-stackable.ts
 *
 * Server action: list a stackable inventory item on the marketplace. §4.2-B
 *
 * "Stackable" assets (resources, seeds, food, fish, egg shards, frogments,
 * crafting materials) are listed by quantity with a per-unit price.
 * Partial fills are supported — a buyer may purchase less than the full
 * quantity, and the listing remains active with reduced quantity. §4.4-C
 *
 * Reservation mechanic (GDD §9.7):
 *   Before listing:  items["Iron Ore"] = 250, marketReservations = {}
 *   Player lists 100: items["Iron Ore"] -= 100 (usable reduced)
 *                     marketReservations["Iron Ore"].amount = 100 (reserved)
 *   After listing:   items["Iron Ore"] = 150, marketReservations["Iron Ore"].amount = 100
 *
 * One listing per item name per player — enforced by checking
 * `marketReservations[itemName]?.listed`. §4.2-B
 *
 * Execution order:
 *   1. Validate params (pricePerUnit, duration, quantity > 0).
 *   2. Load inventory and verify usable quantity.
 *   3. Check one-listing-per-item and active listing cap.
 *   4. Atomically:
 *      a. Deduct from `items[name]` and write `marketReservations[name]` on inventory.
 *      b. Insert search-index entry in marketplace_listings.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.2-B
 *            docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.7, §9.24
 */

import {
  MARKETPLACE_CONFIG,
  validateListingParams,
  TRADABLE_ASSET_TYPES,
} from "@/shared/data/marketplace";
import type { TradableAssetType } from "@/shared/types/marketplace";
import { InventoryModel } from "@/lib/modules/inventories/model.server";
import type { InventoryItemMarket, IInventoryItem } from "@/lib/modules/inventories/types.server";
import { generateListingHash } from "@/lib/modules/marketplace/hash.server";
import { countActiveListingsBySeller } from "@/lib/modules/marketplace/query.server";
import { getItemAssetType } from "@/lib/events/list-asset/item-asset-type";

// ---------------------------------------------------------------------------
// Input / Result types
// ---------------------------------------------------------------------------

export interface ListStackableAssetInput {
  /** Wallet address of the player creating the listing. */
  sellerId: string;
  /**
   * Canonical item name, matching the key in inventory.items.
   * e.g. "Iron Ore", "Potato Seed", "Egg Shard".
   */
  itemName: string;
  /** Number of units to reserve for sale. Must be >= 1. */
  quantity: number;
  /** Price per individual unit in Game Balance. Must satisfy price constraints. */
  pricePerUnit: number;
  /**
   * How long the listing should be live, in seconds.
   * Defaults to MARKETPLACE_CONFIG.defaultDurationSeconds (72 h) if omitted.
   */
  durationSeconds?: number;
}

export type ListStackableAssetResult =
  | {
      status: "ok";
      listingId: string;
      itemName: string;
      assetType: TradableAssetType;
      quantity: number;
      pricePerUnit: number;
      expiresAt: Date;
    }
  | { status: "item-not-found" }
  | { status: "insufficient-quantity"; usable: number; requested: number }
  | { status: "item-already-listed" }
  | { status: "listing-limit-reached" }
  | { status: "invalid-quantity" }
  | { status: "validation-error"; message: string }
  | { status: "seller-not-found" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

/**
 * Lists `quantity` units of `itemName` from the seller's inventory. §4.2-B
 *
 * Atomically decrements `items[itemName]` (usable) and writes the embedded
 * `market` reservation (reserved) on the inventory document. The embed keyed by
 * `market.hash` IS the listing — there is no separate index collection. §Phase 3
 *
 * @throws Never — all error states returned as typed result variants.
 */
export async function listStackableAsset(
  input: ListStackableAssetInput,
): Promise<ListStackableAssetResult> {

  const {
    sellerId,
    itemName,
    quantity,
    pricePerUnit,
    durationSeconds = MARKETPLACE_CONFIG.defaultDurationSeconds,
  } = input;

  // ── Step 1: Basic quantity check ────────────────────────────────────────────
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { status: "invalid-quantity" };
  }

  // ── Step 2: Validate price and duration ─────────────────────────────────────
  try {
    validateListingParams(pricePerUnit, durationSeconds);
  } catch (err: unknown) {
    return {
      status: "validation-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // ── Step 3: Load the item document ──────────────────────────────────────────
  // One document per (owner, item). §9.24
  const itemDoc = await InventoryModel
    .findOne({ owner: sellerId, item: itemName })
    .lean<IInventoryItem>();
  if (!itemDoc) return { status: "item-not-found" };

  const usable = itemDoc.amount ?? 0;

  if (usable <= 0) return { status: "item-not-found" };
  if (usable < quantity) {
    return { status: "insufficient-quantity", usable, requested: quantity };
  }

  // ── Step 4: One-listing-per-item guard ──────────────────────────────────────
  // The item's embedded `market` holds the active reservation (null = none). §9.7
  if (itemDoc.market?.listed === true) {
    return { status: "item-already-listed" };
  }

  // ── Step 5: Active listing cap ──────────────────────────────────────────────
  const activeCt = await countActiveListingsBySeller(sellerId);
  if (activeCt >= MARKETPLACE_CONFIG.maxActiveListings) {
    return { status: "listing-limit-reached" };
  }

  // ── Step 6: Build reservation values ────────────────────────────────────────
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationSeconds * 1_000);
  const assetType = getItemAssetType(itemName);
  const hash = generateListingHash();

  const reservation: InventoryItemMarket = {
    listed:  true,
    amount:  quantity,
    price:   pricePerUnit,
    seller:  sellerId,
    created: now,
    expires: expiresAt,
    sold:    false,
    hash,
  };

  // ── Step 8: Atomic inventory update ─────────────────────────────────────────
  // Decrement usable quantity and write market reservation atomically.
  // Uses a MongoDB update pipeline so both fields change in one round-trip.
  // If the update fails (e.g. document disappeared), bail out cleanly.
  const updateResult = await InventoryModel.updateOne(
    {
      owner: sellerId,
      item:  itemName,
      // Re-check usable quantity at write time to prevent TOCTOU races.
      amount: { $gte: quantity },
      // Only list if there is no active reservation (avoid clobbering).
      $or: [{ market: null }, { "market.listed": false }],
    },
    {
      $inc: { amount: -quantity },
      $set: { market: reservation },
    },
  );

  if (updateResult.matchedCount === 0) {
    // Re-read to give a precise error
    const freshDoc = await InventoryModel
      .findOne({ owner: sellerId, item: itemName })
      .lean<IInventoryItem>();
    if (!freshDoc) return { status: "item-not-found" };
    if (freshDoc.market?.listed === true) return { status: "item-already-listed" };
    const freshUsable = freshDoc.amount ?? 0;
    if (freshUsable < quantity) {
      return { status: "insufficient-quantity", usable: freshUsable, requested: quantity };
    }
    return { status: "item-not-found" };
  }

  // The embedded reservation IS the listing — `market.hash` is its public
  // identity. There is no separate index collection to write. §Phase 3

  // Verify the asset type is in the allowed tradable set (compile-time guard)
  void (assetType satisfies typeof TRADABLE_ASSET_TYPES[number]);

  return {
    status: "ok",
    listingId: hash,
    itemName,
    assetType,
    quantity,
    pricePerUnit,
    expiresAt,
  };
}

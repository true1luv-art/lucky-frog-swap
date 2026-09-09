/**
 * features/events/list-asset/list-stackable.ts
 *
 * Server action: list a stackable inventory item on the marketplace. §redesign §9
 *
 * "Stackable" assets (resources, seeds, food, fish, crafting materials) are
 * listed by quantity with a per-unit price. Partial fills are supported.
 *
 * Flow (plan §9):
 *   1. Validate params (quantity, price).
 *   2. Load inventory doc — check amount >= quantity.
 *   3. Check item not already listed: listings.hasActiveListing(seller, item).
 *   4. Check active listing cap: listings.countActiveListingsBySeller(seller) < MAX.
 *   5. Insert listings document with status: "active" — get back the new _id.
 *   6. Atomic inventory update: $inc amount: -quantity, set market: { id, amount }.
 *   7. Return _id.toString() as listingId.
 *
 * No hash is generated — `_id` is the listing identity throughout.
 * No expiration — listings have no expiresAt.
 *
 * Reference: docs/marketplace-redesign.md §9
 */

import {
  MARKETPLACE_CONFIG,
  validateListingParams,
  TRADABLE_ASSET_TYPES,
} from "@/features/game/marketplace";
import type { TradableAssetType } from "@/features/types/marketplace";
import { ItemModel } from "@/lib/modules/items/model.server";
import type { IItem } from "@/lib/modules/items/types.server";
import { setMarketBackRef } from "@/lib/modules/items/repository.server";
import {
  createListing,
  countActiveListingsBySeller,
  hasActiveListing,
} from "@/lib/modules/listings/repository.server";
import { getItemAssetType } from "@/features/events/list-asset/item-asset-type";
import { PlayerModel }       from "@/lib/modules/players/model.server";

// ---------------------------------------------------------------------------
// Input / Result types
// ---------------------------------------------------------------------------

export interface ListStackableAssetInput {
  /** Wallet address of the player creating the listing. */
  sellerId: string;
  /** Canonical item name matching the key in inventory.items, e.g. "Iron Ore". */
  itemName: string;
  /** Number of units to list. Must be >= 1. */
  quantity: number;
  /** Price per individual unit in Game Balance. */
  pricePerUnit: number;
  /**
   * Ignored — listings have no expiration in the redesign. Kept for API
   * backward-compatibility so callers that pass `durationSeconds` still compile.
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
      /** Always undefined — listings have no expiration. */
      expiresAt: undefined;
    }
  | { status: "item-not-found" }
  | { status: "insufficient-quantity"; usable: number; requested: number }
  | { status: "item-already-listed" }
  | { status: "listing-limit-reached" }
  | { status: "invalid-quantity" }
  | { status: "validation-error"; message: string }
  | { status: "seller-not-found" };

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

/**
 * Lists `quantity` units of `itemName` from the seller's inventory.
 *
 * Inserts a `listings` document and atomically writes the lightweight
 * `market` back-reference onto the inventory doc. §redesign §9
 *
 * @throws Never — all error states returned as typed result variants.
 */
export async function listStackableAsset(
  input: ListStackableAssetInput,
): Promise<ListStackableAssetResult> {

  const { sellerId, itemName, quantity, pricePerUnit } = input;

  // ── Step 0: Resolve seller wallet → Player _id ───────────────────────────
  const playerDoc = await PlayerModel
    .findOne({ wallet: sellerId }, { _id: 1 })
    .lean<{ _id: import("mongoose").Types.ObjectId }>();
  if (!playerDoc) return { status: "seller-not-found" };
  const sellerObjectId = playerDoc._id;

  // ── Step 1: Basic quantity check ─────────────────────────────────────────
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { status: "invalid-quantity" };
  }

  // ── Step 2: Validate price ───────────────────────────────────────────────
  try {
    validateListingParams(pricePerUnit);
  } catch (err: unknown) {
    return {
      status: "validation-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // ── Step 3: Load the item document ──────────────────────────────────────
  const itemDoc = await ItemModel
    .findOne({ owner: sellerId, item: itemName })
    .lean<IItem>();
  if (!itemDoc) return { status: "item-not-found" };

  const usable = itemDoc.amount ?? 0;
  if (usable <= 0) return { status: "item-not-found" };
  if (usable < quantity) {
    return { status: "insufficient-quantity", usable, requested: quantity };
  }

  // ── Step 4: One-listing-per-item guard ───────────────────────────────────
  const alreadyListed = await hasActiveListing(sellerObjectId, itemName);
  if (alreadyListed) return { status: "item-already-listed" };

  // ── Step 5: Active listing cap ───────────────────────────────────────────
  const activeCt = await countActiveListingsBySeller(sellerObjectId);
  if (activeCt >= MARKETPLACE_CONFIG.maxActiveListings) {
    return { status: "listing-limit-reached" };
  }

  // ── Step 6: Insert listings document ────────────────────────────────────
  const assetType = getItemAssetType(itemName);
  const listing = await createListing({
    seller:    sellerObjectId,
    item:      itemName,
    assetType,
    quantity,
    price:     pricePerUnit,
  });

  // ── Step 7: Atomic inventory update ─────────────────────────────────────
  // Deduct `amount` and write the market back-reference.
  await setMarketBackRef(sellerId, itemName, listing._id as import("mongoose").Types.ObjectId, quantity);

  // Verify the asset type is in the allowed tradable set (compile-time guard).
  void (assetType satisfies typeof TRADABLE_ASSET_TYPES[number]);

  return {
    status:      "ok",
    listingId:   listing._id.toString(),
    itemName,
    assetType,
    quantity,
    pricePerUnit,
    expiresAt:   undefined,
  };
}

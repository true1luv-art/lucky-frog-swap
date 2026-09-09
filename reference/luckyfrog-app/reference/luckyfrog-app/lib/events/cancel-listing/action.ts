/**
 * lib/events/cancel-listing/action.ts
 *
 * Server action: cancel an active marketplace listing. §4.2-C
 *
 * Handles both unique assets (frog, equipment, egg) and stackable assets
 * uniformly. The listing is resolved by its embedded `market.hash` — the
 * standalone `marketplace_listings` index no longer exists. §Phase 3
 *
 * Unique asset cancel:
 *   - Clear the `market` embed on the frog/equipment/egg document → asset is
 *     unlocked.
 *
 * Stackable asset cancel (GDD §9.7 cancel flow):
 *   - Return reserved quantity to usable: `amount += market.amount`.
 *   - Clear the `market` embed on the inventory document.
 *
 * A `listing_cancelled` record is written to `marketplace_logs` so the seller's
 * "My Listings" history survives after the embed is cleared. §Phase 3
 *
 * Only the original seller may cancel. A listing that has already been sold or
 * whose embed is gone cannot be cancelled.
 *
 * NOTE: The expiry sweeper calls this same path with `force: true` to bypass
 * the seller check, passing `logType: "listing_expired"`. §4.2-C
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.2-C
 *            docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.7
 */

import { EquipmentModel } from "@/lib/modules/equipments/model.server";
import { CollectibleModel } from "@/lib/modules/collectibles/model.server";
import { InventoryModel } from "@/lib/modules/inventories/model.server";
import { MarketplaceLogModel } from "@/lib/modules/marketplace-logs/model.server";
import { getItemAssetType } from "@/lib/events/list-asset/item-asset-type";

// `FilterQuery` is not exported by the installed mongoose 9 typings; use a
// permissive local alias for the plain filter objects passed to updateOne.
type FilterQuery<_T> = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Input / Result types
// ---------------------------------------------------------------------------

export interface CancelListingInput {
  /** Wallet address of the player requesting the cancellation. */
  playerId: string;
  /** The listing hash (`market.hash`) of the listing to cancel. */
  hash: string;
  /**
   * Internal flag used by the expiry sweeper only.
   * When true the seller ownership check is bypassed. §4.2-C
   */
  force?: boolean;
  /**
   * Which lifecycle log to write. Defaults to `listing_cancelled`; the expiry
   * sweeper passes `listing_expired`. §Phase 3
   */
  logType?: "listing_cancelled" | "listing_expired";
}

export type CancelListingResult =
  | {
      status: "ok";
      listingId: string;
      assetType: string;
      assetName: string;
      /** Wallet of the seller whose listing was cancelled/expired. */
      sellerId: string;
      /** For stackable cancellations: quantity returned to usable inventory. */
      quantityReturned?: number;
    }
  | { status: "listing-not-found" }
  | { status: "listing-not-active" }
  | { status: "not-seller" }
  | { status: "asset-reservation-missing" };

// ---------------------------------------------------------------------------
// Resolver — find the owning document by market.hash across all collections
// ---------------------------------------------------------------------------

interface ResolvedListing {
  kind: "unique" | "stackable";
  assetType: string;
  /** Asset id: unique = document _id string; stackable = item name. */
  assetId: string;
  assetName: string;
  sellerId: string;
  price: number;
  quantity: number;
  active: boolean;
}

async function resolveByHash(hash: string): Promise<ResolvedListing | null> {
  const q = { "market.hash": hash } as FilterQuery<unknown>;

  const [collectible, equip, inv] = await Promise.all([
    CollectibleModel.findOne(q).lean(),
    EquipmentModel.findOne(q).lean(),
    InventoryModel.findOne(q).lean(),
  ]);

  if (collectible) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueDoc: any = collectible;
    const m = uniqueDoc.market ?? {};
    return {
      kind: "unique",
      assetType: "collectible",
      assetId: String(uniqueDoc._id),
      assetName: uniqueDoc.name ?? "Collectible",
      sellerId: m.seller ?? "",
      price: m.price ?? 0,
      quantity: 1,
      active: m.listed === true && m.sold !== true,
    };
  }

  if (equip) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueDoc: any = equip;
    const m = uniqueDoc.market ?? {};
    return {
      kind: "unique",
      assetType: "equipment",
      assetId: String(uniqueDoc._id),
      assetName: uniqueDoc.name ?? "Equipment",
      sellerId: m.seller ?? "",
      price: m.price ?? 0,
      quantity: 1,
      active: m.listed === true && m.sold !== true,
    };
  }

  if (inv) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = inv;
    const m = d.market ?? {};
    return {
      kind: "stackable",
      assetType: getItemAssetType(d.item),
      assetId: d.item,
      assetName: d.item,
      sellerId: m.seller ?? "",
      price: m.price ?? 0,
      quantity: m.amount ?? 0,
      active: m.listed === true && m.sold !== true,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Unique asset cancel — reset the market embed to unlisted defaults
// ---------------------------------------------------------------------------

/**
 * Empty/unlisted market defaults. Applied on sale, cancel, or expiry so the
 * market sub-document is NEVER set to null — it is always present on the
 * document for consistent querying (mirrors the Egg market embed shape).
 */
const EMPTY_MARKET = {
  listed:   false,
  price:    0,
  seller:   null,
  created:  null,
  expires:  null,
  sold:     false,
  hash:     undefined,
  locked:   false,
  lockedAt: undefined,
} as const;

async function cancelUniqueAsset(
  assetType: string,
  assetId: string,
): Promise<void> {
  const Model = assetType === "collectible"
    ? CollectibleModel
    : assetType === "equipment"
      ? EquipmentModel
      : null;
  if (!Model) throw new Error(`Asset type ${assetType} is not tradable`);
  // Mongoose model unions do not expose compatible overloaded signatures.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (Model as any).updateOne(
    { _id: assetId } as FilterQuery<unknown>,
    { $set: { market: EMPTY_MARKET } },
  );
}

// ---------------------------------------------------------------------------
// Stackable asset cancel — return reserved quantity, clear embed
// ---------------------------------------------------------------------------

/**
 * Atomically returns the reserved quantity to usable inventory and clears the
 * `market` embed, keyed by the listing hash to avoid races. §4.2-C, GDD §9.7.
 *
 * @returns The quantity returned to usable inventory, or null if not found.
 */
async function cancelStackableAsset(
  sellerId: string,
  itemName: string,
  hash: string,
  reservedQty: number,
): Promise<number | null> {
  const res = await InventoryModel.updateOne(
    { owner: sellerId, item: itemName, "market.hash": hash, "market.listed": true },
    {
      $inc: { amount: reservedQty },
      $set: { market: null },
    },
  );
  return res.matchedCount === 1 ? reservedQty : null;
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

/**
 * Cancels an active marketplace listing for any asset type. §4.2-C
 *
 * Resolves the listing by its embedded `market.hash`, verifies the caller is
 * the seller (unless `force` is set), delegates to the appropriate cleanup
 * path, then writes a lifecycle log so history survives. §Phase 3
 *
 * @throws Never — all error states returned as typed result variants.
 */
export async function cancelListing(
  input: CancelListingInput,
): Promise<CancelListingResult> {

  const { playerId, hash, force = false, logType = "listing_cancelled" } = input;

  // ── Step 1: Resolve the listing from the embedded market.hash ──────────────
  const listing = await resolveByHash(hash);
  if (!listing) return { status: "listing-not-found" };

  // ── Step 2: Guard — must still be active ──────────────────────────────────
  if (!listing.active) {
    return { status: "listing-not-active" };
  }

  // ── Step 3: Guard — only the seller may cancel (unless forced by sweeper) ─
  if (!force && listing.sellerId !== playerId) {
    return { status: "not-seller" };
  }

  // ── Step 4: Asset-type-specific cleanup ───────────────────────────────────
  let quantityReturned: number | undefined;

  if (listing.kind === "unique") {
    await cancelUniqueAsset(listing.assetType, listing.assetId);
  } else {
    const returned = await cancelStackableAsset(
      listing.sellerId,
      listing.assetId,
      hash,
      listing.quantity,
    );
    if (returned === null) {
      // Reservation was already consumed by a concurrent purchase. Non-fatal —
      // the embed is gone, so there is nothing left to cancel. §9.24
      return { status: "asset-reservation-missing" };
    }
    quantityReturned = returned;
  }

  // ── Step 5: Write the lifecycle log so "My Listings" keeps history ────────
  await MarketplaceLogModel.create({
    type:        logType,
    listingId:   hash,
    assetType:   listing.assetType,
    assetId:     listing.assetId,
    assetName:   listing.assetName,
    sellerId:    listing.sellerId,
    quantity:    listing.quantity,
    price:       listing.price,
    totalPrice:  0,
    fee:         0,
    sellerNet:   0,
    completedAt: new Date(),
  });

  return {
    status: "ok",
    listingId: hash,
    assetType: listing.assetType,
    assetName: listing.assetName,
    sellerId: listing.sellerId,
    ...(quantityReturned !== undefined ? { quantityReturned } : {}),
  };
}

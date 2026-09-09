/**
 * lib/modules/marketplace/query.server.ts
 *
 * Embedded-`market` marketplace query layer. §Phase 3
 *
 * The `marketplace_listings` search index has been deleted. Active listings now
 * live ONLY as embedded `market` sub-documents on the four tradable
 * collections: `frogs`, `equipment`, `eggs`, `inventories`. This module is the
 * single place that reconstructs the normalized `ListingView` shape from those
 * embeds and resolves a `market.hash` back to its owning document.
 *
 * Design notes:
 *   - `market.hash` is the public listing identity (see listing-view.ts). Every
 *     read keys off it, and it is unique across all four collections by
 *     construction (hash.ts).
 *   - Seller display names are NOT stored on the embed — they are resolved in
 *     batch from the `players` collection at read time.
 *   - "Active" == `market.listed === true && market.sold !== true`. Terminal
 *     states are reconstructed from `marketplace_logs`, never from embeds.
 *
 * Reference: docs/implementation_plans/luckfrog-smart-contract-refactor.md §3 (Phase 3)
 */

import { isUniqueAsset } from "@/shared/data/marketplace";
import type { TradableAssetType } from "@/shared/types/marketplace";
import { EquipmentModel } from "@/lib/modules/equipments/model.server";
import { CollectibleModel } from "@/lib/modules/collectibles/model.server";
import { InventoryModel } from "@/lib/modules/inventories/model.server";
import { PlayerModel } from "@/lib/modules/players/model.server";
import { getItemAssetType } from "@/lib/events/list-asset/item-asset-type";
import type { ListingView } from "@/shared/marketplace/listing-view";

// `FilterQuery` is not exported by the installed mongoose 9 typings, so we use
// a permissive local alias for the plain filter objects passed to
// `Model.find(...)` / `Model.countDocuments(...)`. §Phase 3
type FilterQuery<_T> = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Raw embed shape (shared by all four collections)
// ---------------------------------------------------------------------------

interface RawMarket {
  listed?: boolean;
  sold?: boolean;
  price?: number;
  amount?: number; // stackable only
  seller?: string | null;
  created?: Date | null;
  expires?: Date | null;
  hash?: string;
  locked?: boolean;
  lockedAt?: Date | null;
}

// ---------------------------------------------------------------------------
// Seller-name resolution
// ---------------------------------------------------------------------------

/**
 * Resolves wallet → display name for a batch of sellers from the `players`
 * collection. Falls back to the wallet address when no username is set.
 */
async function resolveSellerNames(
  wallets: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(wallets.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const players = await PlayerModel.find({ wallet: { $in: unique } })
    .select("wallet username")
    .lean<Array<{ wallet: string; username?: string }>>();

  for (const p of players) {
    map.set(p.wallet, p.username ?? p.wallet);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Per-collection mappers → ListingView (sellerName filled in later)
// ---------------------------------------------------------------------------

type ViewDraft = Omit<ListingView, "sellerName">;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function draftFromUnique(
  assetType: TradableAssetType, // Only equipment (Phase 3 - frogs/eggs removed)
  doc: {
    _id: unknown;
    name?: string;
    market?: RawMarket | null;
  },
): ViewDraft | null {
  const m = doc.market;
  if (!m?.hash || !m.listed || m.sold) return null;
  const assetName = doc.name ?? assetType;
  return {
    _id: m.hash,
    hash: m.hash,
    assetType: assetType as TradableAssetType,
    assetId: String(doc._id),
    assetName,
    sellerId: m.seller ?? "",
    price: m.price ?? 0,
    quantity: 1,
    category: assetType,
    status: "active",
    createdAt: m.created ?? new Date(0),
    expiresAt: m.expires ?? new Date(0),
  };
}

function draftFromInventory(doc: {
  item: string;
  market?: RawMarket | null;
}): ViewDraft | null {
  const m = doc.market;
  if (!m?.hash || !m.listed || m.sold) return null;
  const assetType = getItemAssetType(doc.item);
  return {
    _id: m.hash,
    hash: m.hash,
    assetType,
    assetId: doc.item,
    assetName: doc.item,
    sellerId: m.seller ?? "",
    price: m.price ?? 0,
    quantity: m.amount ?? 0,
    category: assetType,
    status: "active",
    createdAt: m.created ?? new Date(0),
    expiresAt: m.expires ?? new Date(0),
  };
}

async function attachSellerNames(drafts: ViewDraft[]): Promise<ListingView[]> {
  const names = await resolveSellerNames(drafts.map((d) => d.sellerId));
  return drafts.map((d) => ({
    ...d,
    sellerName: names.get(d.sellerId) ?? d.sellerId,
  }));
}

// ---------------------------------------------------------------------------
// Hash resolver — market.hash → owning document (active listings only)
// ---------------------------------------------------------------------------

/**
 * Resolves an active listing by its `market.hash`, scanning the four tradable
 * collections. Only listings whose embed is still `listed` and not `sold` are
 * returned — a hash that has already settled/cancelled/expired resolves to null.
 *
 * @param hash the listing hash extracted from the on-chain purchase memo
 */
export async function findActiveListingByHash(
  hash: string,
): Promise<ListingView | null> {
  if (!hash) return null;

  const q = { "market.hash": hash, "market.listed": true } as FilterQuery<unknown>;

  const [collectible, equip, inv] = await Promise.all([
    CollectibleModel.findOne(q).lean(),
    EquipmentModel.findOne(q).lean(),
    InventoryModel.findOne(q).lean(),
  ]);

  let draft: ViewDraft | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (collectible) draft = draftFromUnique("collectible", collectible as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else if (equip) draft = draftFromUnique("equipment", equip as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else if (inv) draft = draftFromInventory(inv as any);

  if (!draft) return null;
  const [view] = await attachSellerNames([draft]);
  return view ?? null;
}

// ---------------------------------------------------------------------------
// Browse — aggregate active embeds across the four collections
// ---------------------------------------------------------------------------

export interface BrowseListingsParams {
  assetType?: string;
  assetName?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface BrowseListingsResult {
  listings: ListingView[];
  total: number;
  page: number;
  pages: number;
}

const STACKABLE_TO_INVENTORY = new Set<string>([
  "resource",
  "seed",
  "food",
  "frogment",
  "fish",
  "crafting_material",
]);

/**
 * Browses active listings with optional filters, sorting, and pagination.
 *
 * Listings are gathered from each relevant collection's embedded `market`
 * sub-documents, merged, filtered, sorted, then paginated in application code.
 * This keeps the cross-collection union simple and correct for the marketplace
 * scale (each player is capped at `maxActiveListings`). §4.3-A
 */
export async function browseListings(
  params: BrowseListingsParams,
): Promise<BrowseListingsResult> {

  const {
    assetType,
    assetName,
    minPrice,
    maxPrice,
    sort = "newest",
    page = 1,
    limit = 20,
  } = params;

  const wantsCollectible = !assetType || assetType === "collectible";
  const wantsEquip = !assetType || assetType === "equipment";
  const wantsInventory =
    !assetType || STACKABLE_TO_INVENTORY.has(assetType);

  // Base embed filter shared by every collection.
  const base: Record<string, unknown> = {
    "market.listed": true,
    "market.sold": { $ne: true },
  };
  if (minPrice !== undefined || maxPrice !== undefined) {
    base["market.price"] = {
      ...(minPrice !== undefined ? { $gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
    };
  }

  const uniqueFilter = (): FilterQuery<unknown> => ({ ...base });

  const invFilter: Record<string, unknown> = { ...base };
  if (assetName) invFilter.item = assetName;

  const [collectibles, equipment, inventory] = await Promise.all([
    wantsCollectible ? CollectibleModel.find(uniqueFilter()).lean() : Promise.resolve([]),
    wantsEquip ? EquipmentModel.find(uniqueFilter()).lean() : Promise.resolve([]),
    wantsInventory ? InventoryModel.find(invFilter as FilterQuery<unknown>).lean() : Promise.resolve([]),
  ]);

  const drafts: ViewDraft[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of collectibles as any[]) { const v = draftFromUnique("collectible", d); if (v) drafts.push(v); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of equipment as any[]) { const v = draftFromUnique("equipment", d); if (v) drafts.push(v); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of inventory as any[]) { const v = draftFromInventory(d); if (v) drafts.push(v); }

  // Stackable asset-type filter: a specific stackable type maps only to
  // matching inventory items (getItemAssetType is applied during mapping).
  let filtered = drafts;
  if (assetType && STACKABLE_TO_INVENTORY.has(assetType)) {
    filtered = drafts.filter((d) => d.assetType === assetType);
  }

  // Sort.
  const ts = (v: string | Date) => new Date(v).getTime();
  const sorters: Record<string, (a: ViewDraft, b: ViewDraft) => number> = {
    price_asc:     (a, b) => a.price - b.price || ts(b.createdAt) - ts(a.createdAt),
    price_desc:    (a, b) => b.price - a.price || ts(b.createdAt) - ts(a.createdAt),
    newest:        (a, b) => ts(b.createdAt) - ts(a.createdAt),
    oldest:        (a, b) => ts(a.createdAt) - ts(b.createdAt),
    quantity_desc: (a, b) => b.quantity - a.quantity || ts(b.createdAt) - ts(a.createdAt),
  };
  filtered = [...filtered].sort(sorters[sort] ?? sorters.newest);

  const total = filtered.length;
  const safeLimit = Math.min(100, Math.max(1, limit));
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * safeLimit;
  const pageDrafts = filtered.slice(start, start + safeLimit);

  const listings = await attachSellerNames(pageDrafts);

  return {
    listings,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit),
  };
}

// ---------------------------------------------------------------------------
// Detail — resolve a single active listing (+ its live asset) by hash
// ---------------------------------------------------------------------------

/** Returns the active listing view for a hash, or null. §4.3-B */
export async function getActiveListingByHash(
  hash: string,
): Promise<ListingView | null> {
  return findActiveListingByHash(hash);
}

// ---------------------------------------------------------------------------
// Seller queries — "My Listings" active tab + listing-cap enforcement
// ---------------------------------------------------------------------------

/**
 * Counts a seller's active listings across all four collections. Used to
 * enforce `MARKETPLACE_CONFIG.maxActiveListings`. §9.26
 */
export async function countActiveListingsBySeller(
  sellerId: string,
): Promise<number> {
  const q = {
    "market.listed": true,
    "market.sold": { $ne: true },
    "market.seller": sellerId,
  } as FilterQuery<unknown>;

  const [a, b, d] = await Promise.all([
    CollectibleModel.countDocuments(q),
    EquipmentModel.countDocuments(q),
    InventoryModel.countDocuments(q),
  ]);
  return a + b + d;
}

/** Returns a seller's active listings (across all collections) as views. §4.3-D */
export async function findActiveListingsBySeller(
  sellerId: string,
): Promise<ListingView[]> {
  const q = {
    "market.listed": true,
    "market.sold": { $ne: true },
    "market.seller": sellerId,
  } as FilterQuery<unknown>;

  const [collectibles, equipment, inventory] = await Promise.all([
    CollectibleModel.find(q).lean(),
    EquipmentModel.find(q).lean(),
    InventoryModel.find(q).lean(),
  ]);

  const drafts: ViewDraft[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of collectibles as any[]) { const v = draftFromUnique("collectible", d); if (v) drafts.push(v); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of equipment as any[]) { const v = draftFromUnique("equipment", d); if (v) drafts.push(v); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of inventory as any[]) { const v = draftFromInventory(d); if (v) drafts.push(v); }

  return attachSellerNames(drafts);
}

// ---------------------------------------------------------------------------
// Aggregate / admin queries — replace the deleted index's countDocuments/find
// ---------------------------------------------------------------------------

/**
 * Counts every active listing across all four tradable collections. Replaces
 * the deleted `MarketplaceListingModel.countDocuments({ status: "active" })`.
 * Used by the marketplace analytics endpoint. §4.3
 */
export async function countAllActiveListings(): Promise<number> {
  const q = {
    "market.listed": true,
    "market.sold": { $ne: true },
  } as FilterQuery<unknown>;

  const [a, b, d] = await Promise.all([
    CollectibleModel.countDocuments(q),
    EquipmentModel.countDocuments(q),
    InventoryModel.countDocuments(q),
  ]);
  return a + b + d;
}

/**
 * Returns active listing views whose `assetName` is in `assetNames`. Replaces
 * the deleted `MarketplaceListingModel.find({ status: "active", assetName })`
 * used by the admin suspicious-pricing analyzer. §4.3
 */
export async function findActiveListingsByAssetNames(
  assetNames: string[],
): Promise<ListingView[]> {
  if (assetNames.length === 0) return [];

  const names = new Set(assetNames);
  const base = {
    "market.listed": true,
    "market.sold": { $ne: true },
  } as FilterQuery<unknown>;

  const [collectibles, equipment, inventory] = await Promise.all([
    CollectibleModel.find({ ...base, name: { $in: assetNames } } as FilterQuery<unknown>).lean(),
    EquipmentModel.find({ ...base, name: { $in: assetNames } }).lean(),
    InventoryModel.find({ ...base, item: { $in: assetNames } }).lean(),
  ]);

  const drafts: ViewDraft[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of collectibles as any[]) { const v = draftFromUnique("collectible", d); if (v && names.has(v.assetName)) drafts.push(v); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of equipment as any[]) { const v = draftFromUnique("equipment", d); if (v && names.has(v.assetName)) drafts.push(v); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of inventory as any[]) { const v = draftFromInventory(d); if (v && names.has(v.assetName)) drafts.push(v); }

  return attachSellerNames(drafts);
}

// ---------------------------------------------------------------------------
// Concurrency lock — moved from the deleted index onto the embed. §9.20
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function modelForAssetType(assetType: TradableAssetType): any {
  if (assetType === "collectible") return CollectibleModel;
  if (assetType === "equipment") return EquipmentModel;
  return InventoryModel;
}

/**
 * Acquires a concurrency lock on the listing that owns `hash` by atomically
 * flipping `market.locked: false → true` on the owning document. Stale locks
 * (older than `staleThresholdMs`) are stolen. Returns true if acquired. §9.20
 */
export async function acquireListingLock(
  assetType: TradableAssetType,
  hash: string,
  staleThresholdMs: number,
): Promise<boolean> {
  const Model = modelForAssetType(assetType);
  const staleThreshold = new Date(Date.now() - staleThresholdMs);
  const result = await Model.findOneAndUpdate(
    {
      "market.hash": hash,
      "market.listed": true,
      $or: [
        { "market.locked": { $ne: true } },
        { "market.lockedAt": { $lt: staleThreshold } },
      ],
    },
    { $set: { "market.locked": true, "market.lockedAt": new Date() } },
    { new: false },
  );
  return result !== null;
}

/** Releases the concurrency lock on the listing that owns `hash`. §9.20 */
export async function releaseListingLock(
  assetType: TradableAssetType,
  hash: string,
): Promise<void> {
  const Model = modelForAssetType(assetType);
  await Model.updateOne(
    { "market.hash": hash },
    { $set: { "market.locked": false }, $unset: { "market.lockedAt": "" } },
  ).catch(() => {
    console.error(
      `[marketplace-query] Failed to release lock for listing hash ${hash}`,
    );
  });
}

export { isUniqueAsset };

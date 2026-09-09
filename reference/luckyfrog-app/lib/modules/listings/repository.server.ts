/**
 * lib/modules/listings/repository.server.ts
 *
 * All DB operations for the `listings` collection.
 *
 * All DB operations for the `listings` collection — import directly from here.
 */

import mongoose, { Types } from "mongoose";
import { ListingModel } from "./model.server";
import type { IListing, ListingDoc, ListingStatus } from "./types.server";
import { connectDatabase } from "@/lib/config/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateListingInput {
  /** Player _id ObjectId — the ref to the players collection. */
  seller: Types.ObjectId;
  item: string;
  assetType: string;
  quantity: number;
  price: number;
}

export interface BrowseListingsInput {
  assetType?: string;
  item?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface BrowseListingsOutput {
  docs: ListingDoc[];
  total: number;
  page: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Inserts a new active listing and returns its document.
 */
export async function createListing(
  input: CreateListingInput,
): Promise<IListing> {
  await connectDatabase();
  return ListingModel.create({
    seller:    input.seller,
    item:      input.item,
    assetType: input.assetType,
    quantity:  input.quantity,
    price:     input.price,
    status:    "active",
    fee:       0,
    sellerNet: 0,
    buyerId:   null,
    completedAt: null,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Finds a listing by its _id string. Returns null if not found. */
export async function findListingById(
  id: string,
): Promise<ListingDoc | null> {
  await connectDatabase();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return ListingModel
    .findById(id)
    .lean<ListingDoc>();
}

/** Counts a seller's active listings. Used for the listing cap check. */
export async function countActiveListingsBySeller(
  seller: Types.ObjectId,
): Promise<number> {
  await connectDatabase();
  return ListingModel.countDocuments({ seller, status: "active" });
}

/** Checks whether a seller already has an active listing for a given item. */
export async function hasActiveListing(
  seller: Types.ObjectId,
  item: string,
): Promise<boolean> {
  await connectDatabase();
  const doc = await ListingModel
    .findOne({ seller, item, status: "active" }, { _id: 1 })
    .lean();
  return doc !== null;
}

/**
 * Returns all listings for a seller filtered by status.
 * Sorted by createdAt descending.
 */
export async function findListingsBySeller(
  seller: Types.ObjectId,
  status?: ListingStatus,
): Promise<ListingDoc[]> {
  await connectDatabase();
  const filter: Record<string, unknown> = { seller };
  if (status) filter.status = status;
  return ListingModel
    .find(filter)
    .sort({ createdAt: -1 })
    .lean<ListingDoc[]>();
}

/**
 * Browse active listings with optional filters, sorting, and pagination.
 * All sorting / filtering / pagination is handled by MongoDB — no in-memory ops.
 */
export async function browseListings(
  params: BrowseListingsInput,
): Promise<BrowseListingsOutput> {
  await connectDatabase();

  const {
    assetType,
    item,
    minPrice,
    maxPrice,
    sort = "newest",
    page = 1,
    limit = 20,
  } = params;

  const filter: Record<string, unknown> = { status: "active" };
  if (assetType) filter.assetType = assetType;
  if (item)      filter.item = item;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {
      ...(minPrice !== undefined ? { $gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
    };
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    price_asc:     { price: 1,  createdAt: -1 },
    price_desc:    { price: -1, createdAt: -1 },
    newest:        { createdAt: -1 },
    oldest:        { createdAt: 1 },
    quantity_desc: { quantity: -1, createdAt: -1 },
  };
  const mongoSort = sortMap[sort] ?? sortMap.newest;

  const safeLimit = Math.min(100, Math.max(1, limit));
  const safePage  = Math.max(1, page);

  const [total, docs] = await Promise.all([
    ListingModel.countDocuments(filter),
    ListingModel
      .find(filter)
      .sort(mongoSort)
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean<ListingDoc[]>(),
  ]);

  return {
    docs,
    total,
    page:  safePage,
    pages: Math.ceil(total / safeLimit),
  };
}

// ---------------------------------------------------------------------------
// Terminal writes
// ---------------------------------------------------------------------------

/**
 * Marks a listing as sold.
 * Called by settlePurchase after a full fill (quantity reaches 0).
 */
export async function markListingSold(
  id: mongoose.Types.ObjectId | string,
  buyerId:   string,
  fee:       number,
  sellerNet: number,
): Promise<void> {
  await connectDatabase();
  await ListingModel.updateOne(
    { _id: id, status: "active" },
    {
      $set: {
        status:      "sold",
        buyerId,
        fee,
        sellerNet,
        completedAt: new Date(),
      },
    },
  );
}

/**
 * Decrements the available quantity for a partial fill.
 * The listing remains "active".
 */
export async function decrementListingQuantity(
  id:          mongoose.Types.ObjectId | string,
  purchaseQty: number,
): Promise<void> {
  await connectDatabase();
  await ListingModel.updateOne(
    { _id: id, status: "active", quantity: { $gte: purchaseQty } },
    { $inc: { quantity: -purchaseQty } },
  );
}

/**
 * Marks a listing as cancelled.
 * Called by cancelListing action.
 */
export async function markListingCancelled(
  id: mongoose.Types.ObjectId | string,
): Promise<void> {
  await connectDatabase();
  await ListingModel.updateOne(
    { _id: id, status: "active" },
    { $set: { status: "cancelled", completedAt: new Date() } },
  );
}

// ---------------------------------------------------------------------------
// Analytics aggregations
// ---------------------------------------------------------------------------

/** Counts all active listings. Used by analytics endpoint. */
export async function countAllActiveListings(): Promise<number> {
  await connectDatabase();
  return ListingModel.countDocuments({ status: "active" });
}

export interface VolumeStats {
  volumeToday:         number;
  feesCollectedToday:  number;
  volumeWeek:          number;
  totalVolumeAllTime:  number;
  feesCollectedTotal:  number;
}

/** Aggregates volume and fee stats for the analytics endpoint. */
export async function getVolumeStats(): Promise<VolumeStats> {
  await connectDatabase();

  const now        = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const weekStart  = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  type FacetRow = Record<string, number>;
  const [result] = await ListingModel.aggregate<{
    today:   FacetRow[];
    week:    FacetRow[];
    allTime: FacetRow[];
  }>([
    { $match: { status: "sold" } },
    {
      $facet: {
        today: [
          { $match: { completedAt: { $gte: todayStart } } },
          { $group: { _id: null, volume: { $sum: { $multiply: ["$price", "$quantity"] } }, fees: { $sum: "$fee" } } },
        ],
        week: [
          { $match: { completedAt: { $gte: weekStart } } },
          { $group: { _id: null, volume: { $sum: { $multiply: ["$price", "$quantity"] } } } },
        ],
        allTime: [
          { $group: { _id: null, volume: { $sum: { $multiply: ["$price", "$quantity"] } }, fees: { $sum: "$fee" } } },
        ],
      },
    },
  ]);

  const facet    = result ?? { today: [], week: [], allTime: [] };
  const today    = facet.today[0]   ?? {};
  const week     = facet.week[0]    ?? {};
  const allTime  = facet.allTime[0] ?? {};

  return {
    volumeToday:        today.volume  ?? 0,
    feesCollectedToday: today.fees    ?? 0,
    volumeWeek:         week.volume   ?? 0,
    totalVolumeAllTime: allTime.volume ?? 0,
    feesCollectedTotal: allTime.fees   ?? 0,
  };
}

export interface TopAssetRow {
  assetName: string;
  assetType: string;
  volume:    number;
  trades:    number;
  avgPrice:  number;
}

/** Returns the top N assets by total volume (last 30 days). */
export async function getTopAssets(limit = 10): Promise<TopAssetRow[]> {
  await connectDatabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return ListingModel.aggregate<TopAssetRow>([
    { $match: { status: "sold", completedAt: { $gte: since } } },
    {
      $group: {
        _id:      "$item",
        assetType: { $first: "$assetType" },
        volume:   { $sum: { $multiply: ["$price", "$quantity"] } },
        trades:   { $sum: 1 },
        avgPrice: { $avg: "$price" },
      },
    },
    { $sort: { volume: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0, assetName: "$_id", assetType: 1, volume: 1, trades: 1,
        avgPrice: { $round: ["$avgPrice", 4] },
      },
    },
  ]);
}

export interface ActiveSellerRow {
  sellerId: string;
  trades:   number;
  volume:   number;
}

/** Returns the most active sellers (last 30 days, by trade count). */
export async function getMostActiveSellers(limit = 5): Promise<ActiveSellerRow[]> {
  await connectDatabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return ListingModel.aggregate<ActiveSellerRow>([
    { $match: { status: "sold", completedAt: { $gte: since } } },
    { $group: { _id: "$seller", trades: { $sum: 1 }, volume: { $sum: { $multiply: ["$price", "$quantity"] } } } },
    { $sort: { trades: -1 } },
    { $limit: limit },
    { $project: { _id: 0, sellerId: "$_id", trades: 1, volume: { $round: ["$volume", 4] } } },
  ]);
}

export interface EarningsSummary {
  totalEarned:   number;
  totalFeesPaid: number;
}

/** Returns total earnings for a seller (across all sold listings). */
export async function getSellerEarnings(seller: Types.ObjectId): Promise<EarningsSummary> {
  await connectDatabase();
  const [row] = await ListingModel.aggregate<{ totalEarned: number; totalFeesPaid: number }>([
    { $match: { seller, status: "sold" } },
    { $group: { _id: null, totalEarned: { $sum: "$sellerNet" }, totalFeesPaid: { $sum: "$fee" } } },
  ]);
  return {
    totalEarned:   Math.round((row?.totalEarned   ?? 0) * 100) / 100,
    totalFeesPaid: Math.round((row?.totalFeesPaid ?? 0) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// View projection — populate seller and map to ListingView
// ---------------------------------------------------------------------------

import type { ListingView } from "@/features/types/marketplace";

interface PopulatedSeller {
  _id:       Types.ObjectId;
  wallet:    string;
  username?: string;
}

interface PopulatedListingDoc extends Omit<ListingDoc, "seller"> {
  seller: PopulatedSeller;
}

function populatedDocToView(doc: PopulatedListingDoc): ListingView {
  const seller = doc.seller;
  const now    = new Date();
  const locked = doc.lockedUntil && doc.lockedUntil > now;
  return {
    _id:         doc._id.toString(),
    assetType:   doc.assetType as ListingView["assetType"],
    assetName:   doc.item,
    sellerId:    seller.wallet,
    sellerName:  seller.username ?? seller.wallet,
    price:       doc.price,
    quantity:    doc.quantity,
    status:      doc.status,
    createdAt:   doc.createdAt,
    completedAt: doc.completedAt ?? undefined,
    lockedBy:    locked ? doc.lockedBy : null,
    lockedUntil: locked ? doc.lockedUntil : null,
  };
}

function docToView(doc: ListingDoc, sellerWallet: string, sellerName: string): ListingView {
  const now    = new Date();
  const locked = doc.lockedUntil && doc.lockedUntil > now;
  return {
    _id:         doc._id.toString(),
    assetType:   doc.assetType as ListingView["assetType"],
    assetName:   doc.item,
    sellerId:    sellerWallet,
    sellerName,
    price:       doc.price,
    quantity:    doc.quantity,
    status:      doc.status,
    createdAt:   doc.createdAt,
    completedAt: doc.completedAt ?? undefined,
    lockedBy:    locked ? doc.lockedBy : null,
    lockedUntil: locked ? doc.lockedUntil : null,
  };
}

async function attachSellerInfo(docs: ListingDoc[]): Promise<ListingView[]> {
  if (docs.length === 0) return [];
  const ids = docs.map((d) => d._id);
  const populated = await ListingModel
    .find({ _id: { $in: ids } })
    .populate<{ seller: PopulatedSeller }>("seller", "wallet username")
    .lean<PopulatedListingDoc[]>();
  const byId = new Map(populated.map((d) => [d._id.toString(), d]));
  return docs.map((d) => {
    const pop = byId.get(d._id.toString());
    if (pop) return populatedDocToView(pop);
    const fallback = d.seller.toString();
    return docToView(d, fallback, fallback);
  });
}

// Browse with seller view projection.
export interface BrowseListingsParams {
  assetType?: string;
  assetName?: string;
  minPrice?:  number;
  maxPrice?:  number;
  sort?:      string;
  page?:      number;
  limit?:     number;
}

export interface BrowseListingsResult {
  listings: ListingView[];
  total:    number;
  page:     number;
  pages:    number;
}

export async function browseListingsView(
  params: BrowseListingsParams,
): Promise<BrowseListingsResult> {
  const result = await browseListings({
    assetType: params.assetType,
    item:      params.assetName,
    minPrice:  params.minPrice,
    maxPrice:  params.maxPrice,
    sort:      params.sort,
    page:      params.page,
    limit:     params.limit,
  });
  const listings = await attachSellerInfo(result.docs);
  return { listings, total: result.total, page: result.page, pages: result.pages };
}

export async function getActiveListingById(id: string): Promise<ListingView | null> {
  const doc = await findListingById(id);
  if (!doc || doc.status !== "active") return null;
  const [view] = await attachSellerInfo([doc]);
  return view ?? null;
}

export async function getListingById(id: string): Promise<ListingView | null> {
  const doc = await findListingById(id);
  if (!doc) return null;
  const [view] = await attachSellerInfo([doc]);
  return view ?? null;
}

export async function findActiveListingsBySeller(
  seller: Types.ObjectId,
): Promise<ListingView[]> {
  const docs = await findListingsBySeller(seller, "active");
  return attachSellerInfo(docs);
}

export async function findActiveListingsByAssetNames(
  assetNames: string[],
): Promise<ListingView[]> {
  if (assetNames.length === 0) return [];
  const names = new Set(assetNames);
  const allActive = await Promise.all(
    [...names].map((item) =>
      browseListings({ item, sort: "price_asc", limit: 100 }).then((r) => r.docs),
    ),
  );
  return attachSellerInfo(allActive.flat());
}

// ---------------------------------------------------------------------------
// Purchase transaction — pre-check + settlement
// ---------------------------------------------------------------------------

import { computeMarketplaceFee } from "@/features/game/marketplace";
import {
  addInventoryItem,
  clearMarketBackRef,
  decrementMarketAmount,
} from "@/lib/modules/items/repository.server";
import { creditTreasury }            from "@/lib/modules/game-stats/repository.server";
import { PlayerModel }                from "@/lib/modules/players/model.server";
import {
  insertProcessedTransaction,
  findProcessedTransaction,
} from "@/lib/modules/transactions-processed/repository.server";

interface PurchaseAmounts {
  purchaseQty:  number;
  totalPrice:   number;
  fee:          number;
  sellerNet:    number;
  sellerWallet: string;
  assetName:    string;
}

export type BuildPurchaseResult =
  | ({ status: "ok"; listingId: string } & PurchaseAmounts)
  | { status: "listing-not-found" }
  | { status: "listing-not-active" }
  | { status: "cannot-buy-own-listing" }
  | { status: "quantity-exceeds-available"; requested: number; available: number }
  | { status: "invalid-quantity" }
  | { status: "insufficient-balance"; available: number; required: number }
  | { status: "build-error"; detail: string };

export type SettleResult =
  | ({ status: "ok"; listingId: string } & PurchaseAmounts)
  | { status: "listing-not-found" }
  | { status: "listing-not-active" }
  | { status: "cannot-buy-own-listing" }
  | { status: "quantity-exceeds-available"; requested: number; available: number }
  | { status: "invalid-quantity" }
  | { status: "insufficient-balance"; available: number; required: number }
  | { status: "settlement-error"; detail: string };

type QtyError =
  | { status: "invalid-quantity" }
  | { status: "quantity-exceeds-available"; requested: number; available: number };

function resolvePurchaseQty(
  available: number,
  quantity:  number | undefined,
): { ok: true; purchaseQty: number } | { ok: false; error: QtyError } {
  const purchaseQty = quantity ?? available;
  if (!Number.isInteger(purchaseQty) || purchaseQty <= 0) {
    return { ok: false, error: { status: "invalid-quantity" } };
  }
  if (purchaseQty > available) {
    return { ok: false, error: { status: "quantity-exceeds-available", requested: purchaseQty, available } };
  }
  return { ok: true, purchaseQty };
}

/** Rounds to 2 decimal places (cents) so on-chain HFARM amounts stay exact. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeAmounts(
  price:        number,
  purchaseQty:  number,
  sellerWallet: string,
  assetName:    string,
): PurchaseAmounts {
  const totalPrice = round2(price * purchaseQty);
  const fee        = round2(computeMarketplaceFee(totalPrice));
  const sellerNet  = round2(totalPrice - fee);
  return { purchaseQty, totalPrice, fee, sellerNet, sellerWallet, assetName };
}

/**
 * Read-only pre-check — validates the listing and returns the cost breakdown.
 * Does NOT mutate any document. Called by the purchase route before the buyer
 * signs their on-chain payment (and again after, to compute the exact amount).
 *
 * No coin-balance check: the buyer pays the treasury directly on-chain, so
 * there is no in-game coin balance to validate here.
 */
export async function buildPurchaseTransaction(
  buyerId:   string,
  listingId: string,
  quantity?: number,
): Promise<BuildPurchaseResult> {
  const doc = await findListingById(listingId);
  if (!doc) return { status: "listing-not-found" };
  if (doc.status !== "active") return { status: "listing-not-active" };

  const buyer = await PlayerModel
    .findOne({ wallet: buyerId })
    .lean<{ _id: Types.ObjectId }>();
  if (!buyer) return { status: "listing-not-found" };

  if (doc.seller.equals(buyer._id)) return { status: "cannot-buy-own-listing" };

  const qtyResult = resolvePurchaseQty(doc.quantity, quantity);
  if (!qtyResult.ok) return qtyResult.error;

  const amounts = computeAmounts(doc.price, qtyResult.purchaseQty, "", doc.item);

  return { status: "ok", listingId, ...amounts };
}

export interface SettlePurchaseInput {
  listingId:   Types.ObjectId;
  buyerWallet: string;
  quantity:    number | undefined;
  /** On-chain tx hash of the buyer's HFARM payment to the treasury (idempotency key). */
  buyerTxHash: string;
  /** Total HFARM the buyer already paid into the treasury (used for refunds). */
  paidTotal:   number;
}

/** Ledger idempotency keys derived from the buyer's on-chain payment hash. */
const buyLedgerKey    = (txHash: string) => `mp-buy-${txHash}`;
const refundLedgerKey = (txHash: string) => `mp-refund-${txHash}`;

function zeroedAmounts(paidTotal: number): PurchaseAmounts {
  return { purchaseQty: 0, totalPrice: paidTotal, fee: 0, sellerNet: 0, sellerWallet: "", assetName: "" };
}

/**
 * Settles a fully on-chain marketplace purchase. Called exclusively by the
 * transaction-worker. Has no HTTP dependency.
 *
 * The buyer has ALREADY paid the full price to the treasury on-chain
 * (`buyerTxHash`, verified by the purchase route). This function:
 *   1. Atomically CLAIMS the listing (active→sold, or quantity decrement). The
 *      conditional update guarantees exactly one settlement wins, so a retry or
 *      a concurrent worker can never pay the seller twice.
 *   2. Grants the item to the buyer.
 *   3. Pays the seller their net proceeds on-chain (treasury → seller).
 *   4. Retains the fee in the treasury and writes the ledger rows.
 *
 * If the listing can no longer be filled (sold out / cancelled / race), the
 * buyer's payment is refunded on-chain (treasury → buyer), guarded so it can
 * only ever happen once.
 *
 * Failure posture mirrors the withdrawal flow: once the on-chain payout fires,
 * the DB is best-effort and any mismatch is logged CRITICAL for manual
 * reconciliation — funds always remain safe in the treasury.
 */
export async function settlePurchase(input: SettlePurchaseInput): Promise<SettleResult> {
  const { listingId, buyerWallet, quantity, buyerTxHash, paidTotal } = input;
  const listingIdStr = listingId.toString();

  await connectDatabase();

  const { sendSellerPayout, refundBuyer } = await import(
    "@/server/farm-smart-contract/lib/transfers"
  );

  // Resolves a purchase that cannot be filled: refund the buyer on-chain unless
  // this exact payment already settled (retry) or was already refunded.
  async function resolveUnfillable(status: SettleResult): Promise<SettleResult> {
    const settled = await findProcessedTransaction(buyLedgerKey(buyerTxHash));
    if (settled) {
      // This payment already settled successfully — this is a retry. No refund.
      return { status: "ok", listingId: listingIdStr, ...zeroedAmounts(paidTotal) };
    }
    const refunded = await findProcessedTransaction(refundLedgerKey(buyerTxHash));
    if (!refunded && paidTotal > 0) {
      // Let refund errors propagate so the worker retries the refund.
      const { txHash } = await refundBuyer(buyerWallet, paidTotal, buyerTxHash);
      await insertProcessedTransaction({
        txHash:             refundLedgerKey(buyerTxHash),
        wallet:             buyerWallet,
        type:               "marketplace_purchase",
        amount:             paidTotal,
        listingId,
      }).catch((err) => {
        console.error(
          `[listings/repository] Non-fatal: failed to write refund ledger row for ${buyerTxHash}: ` +
          (err instanceof Error ? err.message : String(err)),
        );
      });
      console.warn(
        `[listings/repository] Refunded buyer ${buyerWallet} ${paidTotal} HFARM ` +
        `for unfillable listing ${listingIdStr} (payout tx ${txHash}).`,
      );
    }
    return status;
  }

  const doc = await findListingById(listingIdStr);
  if (!doc) return resolveUnfillable({ status: "listing-not-found" });
  if (doc.status !== "active") return resolveUnfillable({ status: "listing-not-active" });

  const sellerDoc = await PlayerModel
    .findById(doc.seller)
    .lean<{ _id: Types.ObjectId; wallet: string }>();
  const sellerWallet = sellerDoc?.wallet ?? "";

  const buyerDocPre = await PlayerModel
    .findOne({ wallet: buyerWallet })
    .lean<{ _id: Types.ObjectId }>();

  if (buyerDocPre && sellerDoc && doc.seller.equals(buyerDocPre._id)) {
    return resolveUnfillable({ status: "cannot-buy-own-listing" });
  }

  const qtyResult = resolvePurchaseQty(doc.quantity, quantity);
  if (!qtyResult.ok) return resolveUnfillable(qtyResult.error);

  const { purchaseQty } = qtyResult;
  const amounts = computeAmounts(doc.price, purchaseQty, sellerWallet, doc.item);
  const { totalPrice, fee, sellerNet } = amounts;

  // ── 1. Atomic claim ─────����────────────────────────────────────────────────
  // Exactly one settlement can flip active→sold (full) or decrement the
  // available quantity (partial). Losing the claim ⇒ sold out / race ⇒ refund.
  const fullyFilled = purchaseQty >= doc.quantity;
  let claimed = false;
  if (fullyFilled) {
    const res = await ListingModel.updateOne(
      { _id: listingId, status: "active" },
      { $set: { status: "sold", buyerId: buyerWallet, fee, sellerNet, completedAt: new Date() } },
    );
    claimed = res.modifiedCount === 1;
  } else {
    const res = await ListingModel.updateOne(
      { _id: listingId, status: "active", quantity: { $gte: purchaseQty } },
      { $inc: { quantity: -purchaseQty } },
    );
    claimed = res.modifiedCount === 1;
  }

  if (!claimed) return resolveUnfillable({ status: "listing-not-active" });

  // ── 2-4. Claim won — grant item, pay seller on-chain, retain fee ────────────
  // The buy-ledger guard is written FIRST so a crash before the on-chain payout
  // can never double-pay: a retry sees the claim already lost + the guard, and
  // returns ok without re-paying. If the guard is absent, the payout provably
  // never fired, so resolveUnfillable safely refunds instead.
  try {
    await insertProcessedTransaction({
      txHash:             buyLedgerKey(buyerTxHash),
      wallet:             buyerWallet,
      type:               "marketplace_purchase",
      amount:             -totalPrice,
      counterpartyWallet: sellerWallet,
      listingId,
      assetName:          doc.item,
    });

    // Seller inventory bookkeeping (release escrowed market amount).
    if (fullyFilled) {
      await clearMarketBackRef(sellerWallet, doc.item);
    } else {
      await decrementMarketAmount(sellerWallet, doc.item, purchaseQty);
    }

    // Deliver the item to the buyer.
    await addInventoryItem(buyerWallet, doc.item, purchaseQty);

    // On-chain seller payout (treasury → seller, net of fee).
    let payoutTxHash = "";
    if (sellerWallet && sellerNet > 0) {
      const payout = await sendSellerPayout(sellerWallet, sellerNet, buyerTxHash);
      payoutTxHash = payout.txHash;
    }

    // Treasury retains the fee.
    if (fee > 0) {
      await creditTreasury(fee, "marketplace_fee").catch((err) => {
        console.error(
          `[listings/repository] Non-fatal: treasury fee credit failed for listing ${listingIdStr}: ` +
          (err instanceof Error ? err.message : String(err)),
        );
      });
    }

    // Seller sale ledger row (uses the real on-chain payout hash when present).
    await insertProcessedTransaction({
      txHash:             payoutTxHash ? `mp-sale-${payoutTxHash}` : `mp-sale-${buyerTxHash}`,
      wallet:             sellerWallet,
      type:               "marketplace_sale",
      amount:             sellerNet,
      counterpartyWallet: buyerWallet,
      listingId,
      assetName:          doc.item,
    }).catch((err) => {
      console.error(
        `[listings/repository] Non-fatal: failed to write sale ledger row for listing ${listingIdStr}: ` +
        (err instanceof Error ? err.message : String(err)),
      );
    });

    return { status: "ok", listingId: listingIdStr, ...amounts };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // The listing is already claimed and the buy-ledger guard prevents any
    // retry from re-running this block, so we do NOT rethrow (a retry would
    // double-grant the item). Funds remain safe in the treasury — the seller
    // payout either fired or not; reconcile manually via the logged refs.
    console.error(
      `[listings/repository] CRITICAL: post-claim settlement failed for listing ${listingIdStr} ` +
      `(buyer ${buyerWallet}, payment ${buyerTxHash}, sellerNet ${sellerNet}). ` +
      `Manual reconciliation required. Error: ${errMsg}`,
    );
    return { status: "settlement-error", detail: errMsg };
  }
}

// ---------------------------------------------------------------------------
// Price history
// ---------------------------------------------------------------------------

export interface PriceHistoryBucket {
  date:   string;
  avg:    number;
  median: number;
  volume: number;
  count:  number;
}

export interface PriceHistoryInput {
  item:       string;
  assetType?: string;
  days?:      number;
}

/**
 * Returns average and median sale price per day for a given item.
 * Days with no sales are omitted — the UI fills gaps.
 */
export async function getPriceHistory(
  input: PriceHistoryInput,
): Promise<PriceHistoryBucket[]> {
  await connectDatabase();

  const days  = Math.min(90, Math.max(1, input.days ?? 7));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const match: Record<string, unknown> = {
    status: "sold",
    item:   input.item,
    completedAt: { $gte: since },
  };
  if (input.assetType) match.assetType = input.assetType;

  const raw = await ListingModel.aggregate<{
    _id:    string;
    avg:    number;
    prices: number[];
    volume: number;
    count:  number;
  }>([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$completedAt", timezone: "UTC" },
        },
        avg:    { $avg: "$price" },
        prices: { $push: "$price" },
        volume: { $sum: "$quantity" },
        count:  { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return raw.map((bucket) => {
    const sorted = [...bucket.prices].sort((a, b) => a - b);
    const mid    = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    return {
      date:   bucket._id,
      avg:    Math.round(bucket.avg * 100) / 100,
      median: Math.round(median   * 100) / 100,
      volume: bucket.volume,
      count:  bucket.count,
    };
  });
}

// ---------------------------------------------------------------------------
// Optimistic purchase lock
// ---------------------------------------------------------------------------

const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export type AcquireLockResult =
  | { status: "ok"; lockedUntil: Date }
  | { status: "listing-not-found" }
  | { status: "listing-not-active" }
  | { status: "locked-by-other"; lockedUntil: Date }
  | { status: "cannot-lock-own-listing" };

/**
 * Atomically acquires a 10-minute purchase lock on a listing.
 *
 * Uses `findOneAndUpdate` with a compound condition so only one buyer wins the
 * race:  the lock must be absent or expired, OR the same wallet is re-acquiring
 * its own still-valid lock (idempotent re-entry so a page refresh doesn't break
 * the flow).
 *
 * Returns `"locked-by-other"` when a different player currently holds the lock.
 */
export async function acquireListingLock(
  listingId: string,
  buyerWallet: string,
): Promise<AcquireLockResult> {
  await connectDatabase();
  if (!mongoose.Types.ObjectId.isValid(listingId)) return { status: "listing-not-found" };

  // First check if the listing exists and is active.
  const existing = await ListingModel.findById(listingId).lean<IListing>();
  if (!existing)                    return { status: "listing-not-found" };
  if (existing.status !== "active") return { status: "listing-not-active" };

  // Check the seller is not locking their own listing (they can't buy it).
  const sellerDoc = await PlayerModel
    .findById(existing.seller)
    .lean<{ wallet: string }>();
  if (sellerDoc?.wallet?.toLowerCase() === buyerWallet.toLowerCase()) {
    return { status: "cannot-lock-own-listing" };
  }

  const now        = new Date();
  const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);

  // Atomic claim: win if (a) no lock exists, (b) existing lock is expired, or
  // (c) same buyer is re-locking (idempotent).
  const updated = await ListingModel.findOneAndUpdate(
    {
      _id:    listingId,
      status: "active",
      $or: [
        { lockedUntil: null },
        { lockedUntil: { $lte: now } },
        { lockedBy:    buyerWallet },
      ],
    },
    {
      $set: {
        lockedBy:    buyerWallet,
        lockedAt:    now,
        lockedUntil: lockedUntil,
      },
    },
    { new: true },
  ).lean<IListing>();

  if (!updated) {
    // Another player holds a valid lock — return when it expires.
    const blocker = await ListingModel
      .findById(listingId)
      .lean<Pick<IListing, "lockedUntil">>();
    return {
      status:      "locked-by-other",
      lockedUntil: blocker?.lockedUntil ?? new Date(now.getTime() + LOCK_DURATION_MS),
    };
  }

  return { status: "ok", lockedUntil };
}

/**
 * Releases the lock on a listing.  Only the wallet that holds the lock (or any
 * caller for admin/cleanup) may release it.  Silently succeeds if the listing
 * is not found or the lock is already cleared.
 */
export async function releaseListingLock(
  listingId: string,
  buyerWallet: string,
): Promise<void> {
  await connectDatabase();
  if (!mongoose.Types.ObjectId.isValid(listingId)) return;
  await ListingModel.updateOne(
    { _id: listingId, lockedBy: buyerWallet },
    { $set: { lockedBy: null, lockedAt: null, lockedUntil: null } },
  );
}

/**
 * Clears the lock unconditionally (e.g. after a successful settlement so the
 * listing transitions cleanly to "sold" without stale lock fields).
 */
export async function clearListingLock(
  listingId: string | Types.ObjectId,
): Promise<void> {
  await connectDatabase();
  await ListingModel.updateOne(
    { _id: listingId },
    { $set: { lockedBy: null, lockedAt: null, lockedUntil: null } },
  );
}

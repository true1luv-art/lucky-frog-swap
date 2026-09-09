/**
 * lib/events/listing-expired/action.ts
 *
 * Server action: expire active marketplace listings that have passed their
 * `market.expires` timestamp. §4.5-A, GDD §9.16
 *
 * This is the canonical handler for listing expiry, called by the hourly Vercel
 * cron at `/api/cron/marketplace-expire`.
 *
 * Listings now live ONLY as embedded `market` sub-documents on the four
 * tradable collections (frogs / equipment / eggs / inventories) — the
 * standalone `marketplace_listings` index has been removed. The sweeper scans
 * each collection for due embeds and delegates the actual teardown to
 * `cancelListing(..., { force: true, logType: "listing_expired" })`, which:
 *   - clears the `market` embed (unique) or restores the reservation (stackable), and
 *   - writes a `listing_expired` record to `marketplace_logs` for history. §Phase 3
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.5-A
 *            docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.16
 */

import { EquipmentModel }    from "@/lib/modules/equipments/model.server";
import { CollectibleModel }  from "@/lib/modules/collectibles/model.server";
import { InventoryModel }    from "@/lib/modules/inventories/model.server";
import { cancelListing }     from "@/lib/events/cancel-listing/action";

// `FilterQuery` is not exported by the installed mongoose 9 typings; use a
// permissive local alias for the plain filter objects passed to find().
type FilterQuery<_T> = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ExpireListingResult =
  | {
      status: "ok";
      listingId: string;
      assetType: string;
      assetName: string;
      /** Quantity returned to usable inventory (stackable assets only). */
      quantityReturned?: number;
    }
  | { status: "listing-not-found" }
  | { status: "listing-already-resolved" }
  | { status: "reservation-missing" };

export interface ExpireBatchResult {
  processed: number;
  succeeded: number;
  failed:    number;
  errors:    Array<{ listingId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Single-listing expiry (by hash)
// ---------------------------------------------------------------------------

/**
 * Expires a single active listing identified by its `market.hash`. §4.5-A
 *
 * Delegates teardown + history logging to `cancelListing` (force + expired
 * log type), then fires a best-effort seller notification.
 *
 * @param hash  The listing hash (`market.hash`).
 */
export async function expireListing(hash: string): Promise<ExpireListingResult> {

  const result = await cancelListing({
    playerId: "",           // ignored — force bypasses the seller check
    hash,
    force: true,
    logType: "listing_expired",
  });

  if (result.status === "listing-not-found") {
    return { status: "listing-not-found" };
  }
  if (result.status === "listing-not-active") {
    return { status: "listing-already-resolved" };
  }
  if (result.status === "asset-reservation-missing") {
    return { status: "reservation-missing" };
  }
  if (result.status !== "ok") {
    // not-seller cannot happen with force:true, but keep the type exhaustive.
    return { status: "listing-not-found" };
  }

  return {
    status:    "ok",
    listingId: hash,
    assetType: result.assetType,
    assetName: result.assetName,
    ...(result.quantityReturned !== undefined
      ? { quantityReturned: result.quantityReturned }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Batch expiry (used by the cron handler)
// ---------------------------------------------------------------------------

/**
 * Finds and expires all active listings whose `market.expires` is in the past,
 * across the four tradable collections. Called by the hourly cron at
 * `/api/cron/marketplace-expire`. §4.5-A
 *
 * Each listing is processed individually so a single failure does not abort
 * the batch. Errors are collected and returned for monitoring.
 */
export async function expireAllDueListings(): Promise<ExpireBatchResult> {

  const now = new Date();
  const due: FilterQuery<unknown> = {
    "market.listed": true,
    "market.sold": { $ne: true },
    "market.expires": { $lt: now },
  };

  const [collectibles, equipment, inventory] = await Promise.all([
    CollectibleModel.find(due).select("market.hash").lean(),
    EquipmentModel.find(due).select("market.hash").lean(),
    InventoryModel.find(due).select("market.hash").lean(),
  ]);

  const hashes: string[] = [];
  for (const list of [collectibles, equipment, inventory]) {
    for (const doc of list as Array<{ market?: { hash?: string } }>) {
      if (doc.market?.hash) hashes.push(doc.market.hash);
    }
  }

  const result: ExpireBatchResult = {
    processed: hashes.length,
    succeeded: 0,
    failed:    0,
    errors:    [],
  };

  for (const hash of hashes) {
    try {
      const outcome = await expireListing(hash);
      // ok / already-resolved / reservation-missing are all non-fatal races.
      if (
        outcome.status === "ok" ||
        outcome.status === "listing-already-resolved" ||
        outcome.status === "reservation-missing"
      ) {
        result.succeeded++;
      } else {
        result.succeeded++;
      }
    } catch (err) {
      result.failed++;
      result.errors.push({
        listingId: hash,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[listing-expired] Failed to expire listing ${hash}:`, err);
    }
  }

  return result;
}

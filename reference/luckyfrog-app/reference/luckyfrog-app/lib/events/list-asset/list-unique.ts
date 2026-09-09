/**
 * lib/events/list-asset/list-unique.ts
 *
 * Server action: list a unique asset (frog or equipment) on the marketplace. §4.2-A
 *
 * "Unique" assets are traded as a single indivisible item — quantity is always 1.
 * Ownership and listing state are embedded directly on the asset document (§9.7).
 * The standalone `marketplace_listings` search index has been removed — the
 * embedded `market` sub-document (keyed by `market.hash`) IS the listing. §Phase 3
 *
 * Execution order:
 *   1. Validate params (price, duration) against MARKETPLACE_CONFIG.
 *   2. Load the asset document and verify ownership + lock state.
 *   3. Check active listing count against maxActiveListings cap.
 *   4. Embed the market sub-doc on the asset document (single source of truth).
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.2-A
 *            docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.7, §9.24
 */

import { MARKETPLACE_CONFIG, validateListingParams } from "@/shared/data/marketplace";
import { EquipmentModel } from "@/lib/modules/equipments/model.server";
import { CollectibleModel } from "@/lib/modules/collectibles/model.server";
import { generateListingHash } from "@/lib/modules/marketplace/hash.server";
import { countActiveListingsBySeller } from "@/lib/modules/marketplace/query.server";

// `FilterQuery` is not exported by the installed mongoose 9 typings; use a
// permissive local alias for the plain filter objects passed to updateOne.
type FilterQuery<_T> = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Input / Result types
// ---------------------------------------------------------------------------

export interface ListUniqueAssetInput {
  /** Wallet address of the player creating the listing. */
  sellerId: string;
  /** Unique asset type to list. */
  assetType: "frog" | "equipment" | "collectible";
  /**
   * MongoDB _id of the frog or equipment document.
   * For frogs, this is `frog._id` (ObjectId string), NOT `item_number`.
   */
  assetId: string;
  /** Asking price in Game Balance (off-chain LFRG). Must satisfy price constraints. */
  price: number;
  /**
   * How long the listing should be live, in seconds.
   * Defaults to MARKETPLACE_CONFIG.defaultDurationSeconds (72 h) if omitted.
   */
  durationSeconds?: number;
}

export type ListUniqueAssetResult =
  | {
      status: "ok";
      listingId: string;
      assetType: "frog" | "equipment" | "collectible";
      assetId: string;
      assetName: string;
      price: number;
      expiresAt: Date;
    }
  | { status: "asset-not-found" }
  | { status: "not-owner" }
  | { status: "already-listed" }
  | { status: "frog-is-staked" }
  | { status: "listing-limit-reached" }
  | { status: "validation-error"; message: string }
  | { status: "seller-not-found" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the display name for the listing search index.
 * For frogs: uses `frog.name` (e.g. "Ribbit #4821").
 * For equipment: uses `equipment.name` (e.g. "Iron Pickaxe").
 */
function getAssetDisplayName(
  assetType: "frog" | "equipment" | "collectible",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  asset: any,
): string {
  return asset.name ?? assetType;
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

/**
 * Lists a unique asset (frog or equipment) on the marketplace. §4.2-A
 *
 * Performs all guards then atomically embeds the market sub-document on the
 * asset document and inserts a search-index entry in marketplace_listings.
 *
 * @throws Never — all error states are returned as typed result variants.
 */
export async function listUniqueAsset(
  input: ListUniqueAssetInput,
): Promise<ListUniqueAssetResult> {

  const {
    sellerId,
    assetType,
    assetId,
    price,
    durationSeconds = MARKETPLACE_CONFIG.defaultDurationSeconds,
  } = input;

  // ── Step 1: Validate price and duration ────────────────────────────────────
  try {
    validateListingParams(price, durationSeconds);
  } catch (err: unknown) {
    return {
      status: "validation-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // ── Step 2: Frogs and eggs are no longer tradable (Phase 3) ────────────────
  if (assetType !== "equipment" && assetType !== "collectible") {
    return { status: "asset-not-found" };
  }

  // ── Step 3: Load canonical asset data and verify ownership / lock state ────
  const AssetModel = assetType === "collectible" ? CollectibleModel : EquipmentModel;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asset = await (AssetModel as any)
    .findById(assetId)
    .lean() as Record<string, unknown> | null;

  if (!asset) return { status: "asset-not-found" };
  if (asset.owner !== sellerId) return { status: "not-owner" };

  // Listing lock: asset already on marketplace
  if ((asset.market as { listed?: boolean } | null)?.listed === true) {
    return { status: "already-listed" };
  }

  // ── Step 3: Check active listing cap ───────────────────────────────────────
  const activeCt = await countActiveListingsBySeller(sellerId);
  if (activeCt >= MARKETPLACE_CONFIG.maxActiveListings) {
    return { status: "listing-limit-reached" };
  }

  // ── Step 4: Build market embed values ──────────────────────────────────────
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationSeconds * 1_000);
  const assetName = getAssetDisplayName(assetType, asset);
  const hash = generateListingHash();

  const marketEmbed = {
    listed:  true,
    price,
    seller:  sellerId,
    created: now,
    expires: expiresAt,
    sold:    false,
    hash,
  };

  // ── Step 5: Write the embedded market sub-doc (the listing itself) ─────────
  // The embed on the asset document is the single source of truth — there is
  // no separate index collection to keep in sync. `market.hash` is the public
  // listing identity. §Phase 3
  // Mongoose model unions do not expose compatible overloaded signatures.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateResult = await (AssetModel as any).updateOne(
    {
      _id: assetId,
      owner: sellerId,
      "market.listed": { $ne: true },
    } as FilterQuery<typeof asset>,
    { $set: { market: marketEmbed } },
  );
  if (updateResult.matchedCount !== 1) {
    return { status: "already-listed" };
  }

  return {
    status:    "ok",
    listingId: hash,
    assetType,
    assetId,
    assetName,
    price,
    expiresAt,
  };
}

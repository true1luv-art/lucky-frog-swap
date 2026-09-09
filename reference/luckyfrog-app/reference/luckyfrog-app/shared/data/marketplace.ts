/**
 * lib/config/marketplace.ts
 *
 * All marketplace configuration constants. §4.1-D
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.1-D
 *            docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.3, §9.15, §9.20, §9.24, §9.26
 */

import type { TradableAssetType } from "@/shared/types/marketplace";

// ---------------------------------------------------------------------------
// Asset types
// ---------------------------------------------------------------------------

/**
 * All asset types tradeable in Generation One. §9.3, §4.1-D
 *
 * Unique assets (equipment) are traded whole — quantity is always 1.
 * Stackable assets (all others) support partial fills and quantity selection.
 *
 * NOTE: frog and egg are removed from active trading (Phase 3 cleanup).
 * Code handling these asset types is kept as dead-code reference for future summoning rebuild.
 */
export const TRADABLE_ASSET_TYPES = [
  "collectible",
  "equipment",
  "resource",
  "seed",
  "food",
  "frogment",
  "fish",
  "crafting_material",
] as const;

/**
 * Asset types that are unique (non-stackable) — traded as individual items.
 */
export const UNIQUE_ASSET_TYPES: ReadonlySet<TradableAssetType> = new Set([
  "collectible",
  "equipment",
]);

/**
 * Returns true if `assetType` is a unique (non-stackable) asset. §9.3
 * Unique assets: frog, equipment.
 * Stackable assets: everything else.
 */
export function isUniqueAsset(assetType: TradableAssetType): boolean {
  return UNIQUE_ASSET_TYPES.has(assetType);
}

// ---------------------------------------------------------------------------
// Marketplace configuration §4.1-D, GDD §9.15, §9.26
// ---------------------------------------------------------------------------

export const MARKETPLACE_CONFIG = {
  // ---------------------------------------------------------------------------
  // Fee — GDD §9.15
  // ---------------------------------------------------------------------------
  /**
   * 5 % of sale price kept by the marketplace on every settlement (TerraCore
   * parity). In the escrow flow the buyer pays 100 % into the MARKET_TEST
   * wallet, which then pays the seller 95 % and retains this 5 % fee.
   */
  feePercent:  0.05,
  /** Floor fee in Game Balance — prevents micro-listing fee abuse. */
  minimumFee:  0.01,
  /** Cap fee in Game Balance — protects large sellers from excessive fees. */
  maximumFee:  10_000,

  // ---------------------------------------------------------------------------
  // Listing durations
  // ---------------------------------------------------------------------------
  /** Minimum listing duration: 1 hour. */
  minDurationSeconds:     3_600,
  /** Maximum listing duration: 7 days. */
  maxDurationSeconds:   604_800,
  /** Default listing duration when the player does not specify: 72 hours. */
  defaultDurationSeconds: 259_200,

  // ---------------------------------------------------------------------------
  // Price constraints
  // ---------------------------------------------------------------------------
  /** Minimum price per unit in Game Balance. Prevents free listings. */
  minimumPrice: 0.01,
  /** Maximum price per unit in Game Balance. Prevents price-field overflow. */
  maximumPrice: 10_000_000,

  // ---------------------------------------------------------------------------
  // Listing limits — GDD §9.26 TradingConfig
  // ---------------------------------------------------------------------------
  /**
   * Maximum number of active listings a single player may have at one time,
   * counted across all asset types. §9.26
   */
  maxActiveListings: 20,

  // ---------------------------------------------------------------------------
  // Cooldowns — GDD §9.26 TradingConfig
  // ---------------------------------------------------------------------------
  /** Minimum time between consecutive listing actions (ms). */
  listingCooldownMs:  1_000,
  /** Minimum time between consecutive purchase actions (ms). */
  purchaseCooldownMs:   500,
  /**
   * Maximum time a listing may be held in a "locked" state during purchase
   * settlement before the lock is automatically released. §9.20
   */
  lockTimeoutMs: 30_000,
} as const;

// ---------------------------------------------------------------------------
// Fee calculator — GDD §9.15
// ---------------------------------------------------------------------------

/**
 * Computes the marketplace fee for a transaction.
 *
 * Fee = clamp(totalPrice × feePercent, minimumFee, maximumFee).
 * The fee is debited from the buyer's payment BEFORE the seller is credited,
 * matching the GDD §9.27 settlement order exactly.
 *
 * @param totalPrice  Total price paid by the buyer (price × quantity).
 * @returns           Fee amount in Game Balance to credit to the Treasury.
 */
export function computeMarketplaceFee(totalPrice: number): number {
  const raw = totalPrice * MARKETPLACE_CONFIG.feePercent;
  return Math.max(
    MARKETPLACE_CONFIG.minimumFee,
    Math.min(raw, MARKETPLACE_CONFIG.maximumFee),
  );
}

// ---------------------------------------------------------------------------
// Listing parameter validation
// ---------------------------------------------------------------------------

/**
 * Validates that a listing's price and duration fall within configured bounds.
 * Throws a descriptive error if any constraint is violated.
 *
 * @param price           Per-unit asking price in Game Balance.
 * @param durationSeconds Requested listing duration in seconds.
 */
export function validateListingParams(price: number, durationSeconds: number): void {
  if (price < MARKETPLACE_CONFIG.minimumPrice) {
    throw new Error(`PRICE_TOO_LOW: minimum is ${MARKETPLACE_CONFIG.minimumPrice}`);
  }
  if (price > MARKETPLACE_CONFIG.maximumPrice) {
    throw new Error(`PRICE_TOO_HIGH: maximum is ${MARKETPLACE_CONFIG.maximumPrice}`);
  }
  if (durationSeconds < MARKETPLACE_CONFIG.minDurationSeconds) {
    throw new Error(
      `DURATION_TOO_SHORT: minimum is ${MARKETPLACE_CONFIG.minDurationSeconds}s`,
    );
  }
  if (durationSeconds > MARKETPLACE_CONFIG.maxDurationSeconds) {
    throw new Error(
      `DURATION_TOO_LONG: maximum is ${MARKETPLACE_CONFIG.maxDurationSeconds}s`,
    );
  }
}

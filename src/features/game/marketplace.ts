/**
 * shared/game/marketplace.ts
 *
 * All marketplace configuration constants. §4.1-D
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.1-D
 *            docs/new_mechanics/chapter-09-marketplace-and-trading.md §9.3, §9.15, §9.20, §9.24, §9.26
 */

// ---------------------------------------------------------------------------
// Asset types
// ---------------------------------------------------------------------------

/**
 * All asset types tradeable in Generation One. §9.3, §4.1-D
 *
 * All tradable assets are stackable — they support partial fills and
 * quantity selection.
 */
export const TRADABLE_ASSET_TYPES = [
  "resource",
  "seed",
  "food",
  "fish",
  "crafting_material",
] as const;

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
 * Validates that a listing's price and item type are permitted.
 * Throws a descriptive error if any constraint is violated.
 * Listings have no expiration so duration is no longer validated.
 *
 * Phase 7 isolation guard: tools (Axe, Pickaxe, Rod) are soft-economy
 * consumables and must never appear on the token marketplace.
 *
 * @param price    Per-unit asking price in Game Balance.
 * @param itemName The inventory item being listed (optional guard check).
 */
const COIN_ECONOMY_ITEMS = new Set(["Axe", "Pickaxe", "Rod"]);

export function validateListingParams(price: number, itemName?: string): void {
  if (itemName && COIN_ECONOMY_ITEMS.has(itemName)) {
    throw new Error(`ITEM_NOT_LISTABLE: "${itemName}" is a soft-coin item and cannot be listed on the marketplace`);
  }
  if (price < MARKETPLACE_CONFIG.minimumPrice) {
    throw new Error(`PRICE_TOO_LOW: minimum is ${MARKETPLACE_CONFIG.minimumPrice}`);
  }
  if (price > MARKETPLACE_CONFIG.maximumPrice) {
    throw new Error(`PRICE_TOO_HIGH: maximum is ${MARKETPLACE_CONFIG.maximumPrice}`);
  }
}

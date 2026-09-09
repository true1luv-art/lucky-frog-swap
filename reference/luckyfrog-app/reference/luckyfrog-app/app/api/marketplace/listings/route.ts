/**
 * POST /api/marketplace/listings
 *
 * Creates a new marketplace listing for any tradeable asset type.
 *
 * Routes to `listUniqueAsset` (frog, equipment) or `listStackableAsset`
 * (resource, seed, food, fish, egg_shard, frogment, crafting_material)
 * based on the `assetType` field in the request body.
 *
 * Authentication: Bearer token or lfrg_token cookie (same pattern as /api/claim).
 *
 * Rate limiting: MARKETPLACE_CONFIG.listingCooldownMs is enforced client-side;
 * the server enforces maxActiveListings via the action layer. §9.26
 *
 * Request body — unique asset:
 * ```json
 * {
 *   "assetType": "frog" | "equipment",
 *   "assetId": "<MongoDB _id>",
 *   "price": 100,
 *   "durationSeconds": 259200
 * }
 * ```
 *
 * Request body — stackable asset:
 * ```json
 * {
 *   "assetType": "resource" | "seed" | "food" | "fish" | "egg_shard" | "frogment" | "crafting_material",
 *   "itemName": "Iron Ore",
 *   "quantity": 50,
 *   "pricePerUnit": 2.5,
 *   "durationSeconds": 259200
 * }
 * ```
 *
 * Responses:
 *   201 — listing created; body contains listingId and listing details.
 *   400 — validation error or business rule violation.
 *   401 — not authenticated.
 *   403 — not the asset owner.
 *   409 — asset already listed or item already has an active listing.
 *   422 — listing cap reached, frog is staked, or insufficient quantity.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.2-D
 */

import { getWallet } from "@/lib/api/get-wallet";
import { isUniqueAsset, TRADABLE_ASSET_TYPES } from "@/shared/data/marketplace";
import type { TradableAssetType } from "@/shared/types/marketplace";
import { listUniqueAsset } from "@/lib/events/list-asset/list-unique";
import { listStackableAsset } from "@/lib/events/list-asset/list-stackable";
import { browseListings } from "@/lib/modules/marketplace/query.server";
import { expireAllDueListings } from "@/lib/events/listing-expired/action";

// ---------------------------------------------------------------------------
// GET /api/marketplace/listings — browse & filter §4.3-A
// ---------------------------------------------------------------------------

/**
 * Browse the marketplace listing index with optional filters and pagination.
 *
 * Query params (all optional):
 *   assetType  — filter to one asset type
 *   assetName  — filter by exact item name (stackable assets)
 *   rarity     — filter by rarity (frog/equipment only)
 *   minPrice   — minimum price filter
 *   maxPrice   — maximum price filter
 *   sort       — price_asc | price_desc | newest | oldest | quantity_desc
 *   page       — 1-based page number (default 1)
 *   limit      — items per page (default 20, max 100)
 *
 * Always filters to active listings only.
 * Aggregates the embedded `market` sub-documents across the four tradable
 * collections (frogs / equipment / eggs / inventories) via the query layer —
 * the standalone `marketplace_listings` index no longer exists. §4.3-A / §Phase 3
 */
export async function GET(req: Request) {
  // Lazy expiry: fire-and-forget so stale listings are cleaned up on every
  // browse without blocking the response. §4.5-A
  expireAllDueListings().catch((err) =>
    console.error("[marketplace/listings] lazy expiry error:", err),
  );

  const { searchParams } = new URL(req.url);

  const assetType  = searchParams.get("assetType")  ?? undefined;
  const assetName  = searchParams.get("assetName")  ?? undefined;
  const minPrice   = searchParams.get("minPrice")   ? Number(searchParams.get("minPrice"))  : undefined;
  const maxPrice   = searchParams.get("maxPrice")   ? Number(searchParams.get("maxPrice"))  : undefined;
  const sort       = searchParams.get("sort")       ?? "newest";
  const page       = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit      = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  // Validate assetType if provided
  if (assetType && !(TRADABLE_ASSET_TYPES as readonly string[]).includes(assetType)) {
    return Response.json({ error: "Invalid assetType", code: "INVALID_ASSET_TYPE" }, { status: 400 });
  }

  const result = await browseListings({
    assetType,
    assetName,
    minPrice,
    maxPrice,
    sort,
    page,
    limit,
  });

  return Response.json(result);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", code: "INVALID_JSON" }, { status: 400 });
  }

  const { assetType } = body;

  if (typeof assetType !== "string") {
    return Response.json(
      { error: "assetType is required", code: "MISSING_ASSET_TYPE" },
      { status: 400 },
    );
  }

  // ── Route to unique or stackable listing handler ───────────────────────────

  if (isUniqueAsset(assetType as TradableAssetType)) {
    // Unique asset listing (frog or equipment)
    const { assetId, price, durationSeconds } = body;

    if (typeof assetId !== "string" || !assetId) {
      return Response.json({ error: "assetId is required for unique assets", code: "MISSING_ASSET_ID" }, { status: 400 });
    }
    if (typeof price !== "number" || price <= 0) {
      return Response.json({ error: "price must be a positive number", code: "INVALID_PRICE" }, { status: 400 });
    }

    const result = await listUniqueAsset({
      sellerId: wallet,
      assetType: assetType as "frog" | "equipment",
      assetId,
      price,
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : undefined,
    });

    if (result.status === "ok") {
      return Response.json(result, { status: 201 });
    }
    if (result.status === "asset-not-found") {
      return Response.json({ error: "Asset not found", code: result.status }, { status: 404 });
    }
    if (result.status === "not-owner") {
      return Response.json({ error: "You do not own this asset", code: result.status }, { status: 403 });
    }
    if (result.status === "already-listed") {
      return Response.json({ error: "Asset is already listed", code: result.status }, { status: 409 });
    }
    if (result.status === "frog-is-staked") {
      return Response.json({ error: "Frog must be unstaked before listing", code: result.status }, { status: 422 });
    }
    if (result.status === "listing-limit-reached") {
      return Response.json({ error: "Active listing limit reached", code: result.status }, { status: 422 });
    }
    if (result.status === "seller-not-found") {
      return Response.json({ error: "Player not found", code: result.status }, { status: 404 });
    }
    // validation-error
    return Response.json({ error: result.message, code: "VALIDATION_ERROR" }, { status: 400 });
  }

  // Stackable asset listing
  const { itemName, quantity, pricePerUnit, durationSeconds } = body;

  if (typeof itemName !== "string" || !itemName) {
    return Response.json({ error: "itemName is required for stackable assets", code: "MISSING_ITEM_NAME" }, { status: 400 });
  }
  if (typeof quantity !== "number" || quantity <= 0) {
    return Response.json({ error: "quantity must be a positive integer", code: "INVALID_QUANTITY" }, { status: 400 });
  }
  if (typeof pricePerUnit !== "number" || pricePerUnit <= 0) {
    return Response.json({ error: "pricePerUnit must be a positive number", code: "INVALID_PRICE" }, { status: 400 });
  }

  const result = await listStackableAsset({
    sellerId: wallet,
    itemName,
    quantity,
    pricePerUnit,
    durationSeconds: typeof durationSeconds === "number" ? durationSeconds : undefined,
  });

  if (result.status === "ok") {
    return Response.json(result, { status: 201 });
  }
  if (result.status === "item-not-found") {
    return Response.json({ error: "Item not found in inventory", code: result.status }, { status: 404 });
  }
  if (result.status === "insufficient-quantity") {
    return Response.json(
      { error: "Insufficient quantity", code: result.status, usable: result.usable, requested: result.requested },
      { status: 422 },
    );
  }
  if (result.status === "item-already-listed") {
    return Response.json({ error: "This item already has an active listing", code: result.status }, { status: 409 });
  }
  if (result.status === "listing-limit-reached") {
    return Response.json({ error: "Active listing limit reached", code: result.status }, { status: 422 });
  }
  if (result.status === "invalid-quantity") {
    return Response.json({ error: "quantity must be a positive integer", code: result.status }, { status: 400 });
  }
  if (result.status === "seller-not-found") {
    return Response.json({ error: "Player not found", code: result.status }, { status: 404 });
  }
  // validation-error
  return Response.json({ error: result.message, code: "VALIDATION_ERROR" }, { status: 400 });
}

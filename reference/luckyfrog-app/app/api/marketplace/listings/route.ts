/**
 * GET  /api/marketplace/listings — browse active listings.
 * POST /api/marketplace/listings — create a new listing.
 *
 * Browse now delegates to `browseListings` which queries the `listings`
 * collection directly. Sorting / filtering / pagination are all done by
 * MongoDB using the compound indexes on `ListingModel`. §redesign §11
 *
 * No lazy-expiry call is needed — listings have no expiration.
 */

import { getWallet } from "@/lib/api/get-wallet";
import { TRADABLE_ASSET_TYPES } from "@/features/game/marketplace";
import { listStackableAsset } from "@/features/events/list-asset/list-stackable";
import { browseListingsView } from "@/lib/modules/listings/repository.server";

// ---------------------------------------------------------------------------
// GET /api/marketplace/listings
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const assetType = searchParams.get("assetType") ?? undefined;
  const assetName = searchParams.get("assetName") ?? undefined;
  const minPrice  = searchParams.get("minPrice")  ? Number(searchParams.get("minPrice"))  : undefined;
  const maxPrice  = searchParams.get("maxPrice")  ? Number(searchParams.get("maxPrice"))  : undefined;
  const sort      = searchParams.get("sort")      ?? "newest";
  const page      = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit     = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  if (assetType && !(TRADABLE_ASSET_TYPES as readonly string[]).includes(assetType)) {
    return Response.json({ error: "Invalid assetType", code: "INVALID_ASSET_TYPE" }, { status: 400 });
  }

  const result = await browseListingsView({ assetType, assetName, minPrice, maxPrice, sort, page, limit });
  return Response.json(result);
}

// ---------------------------------------------------------------------------
// POST /api/marketplace/listings
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
    return Response.json({ error: "assetType is required", code: "MISSING_ASSET_TYPE" }, { status: 400 });
  }

  const { itemName, quantity, pricePerUnit } = body;

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
    sellerId:    wallet,
    itemName,
    quantity,
    pricePerUnit,
  });

  if (result.status === "ok")                  return Response.json(result, { status: 201 });
  if (result.status === "item-not-found")       return Response.json({ error: "Item not found in inventory", code: result.status }, { status: 404 });
  if (result.status === "insufficient-quantity") return Response.json({ error: "Insufficient quantity", code: result.status, usable: result.usable, requested: result.requested }, { status: 422 });
  if (result.status === "item-already-listed")  return Response.json({ error: "This item already has an active listing", code: result.status }, { status: 409 });
  if (result.status === "listing-limit-reached") return Response.json({ error: "Active listing limit reached", code: result.status }, { status: 422 });
  if (result.status === "invalid-quantity")     return Response.json({ error: "quantity must be a positive integer", code: result.status }, { status: 400 });
  if (result.status === "seller-not-found")     return Response.json({ error: "Player not found", code: result.status }, { status: 404 });
  return Response.json({ error: result.message, code: "VALIDATION_ERROR" }, { status: 400 });
}

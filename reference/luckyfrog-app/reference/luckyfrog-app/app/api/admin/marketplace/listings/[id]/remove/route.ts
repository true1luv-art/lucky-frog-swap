/**
 * POST /api/admin/marketplace/listings/[id]/remove
 *
 * Emergency admin delist — forces a listing off the marketplace due to
 * fraud, exploit, or policy violation. §4.5-D, GDD §9.23
 *
 * This is a force-cancel: it uses the existing cancelListing action with
 * `force: true`, which bypasses the seller ownership check and restores
 * any reserved assets to the seller. The listing status is set to
 * "cancelled" to preserve the audit trail.
 *
 * Auth: x-admin-secret header. §4.5-D
 *
 * Body (optional JSON):
 *   { "reason": "exploit — price below floor" }
 *
 * Response:
 *   { ok: true, listingId, assetType, assetName, reason }
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.5-D
 */

import { headers }         from "next/headers";
import { cancelListing }   from "@/lib/events/cancel-listing/action";

export const runtime = "nodejs";

async function requireAdminAuth(): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const headerStore = await headers();
  const provided    = headerStore.get("x-admin-secret");
  return provided === adminSecret;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireAdminAuth();
  if (!authed) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: listingId } = await params;
  if (!listingId) {
    return Response.json({ error: "Listing ID required" }, { status: 400 });
  }

  // Parse optional reason from body (best-effort — body may be empty).
  let reason = "Admin removal";
  try {
    const body = await req.json();
    if (typeof body?.reason === "string" && body.reason.trim()) {
      reason = body.reason.trim().slice(0, 500);
    }
  } catch {
    // No body or invalid JSON — use default reason.
  }

  // Delegate to the canonical cancel action with force=true.
  // This restores reserved assets and marks the listing as "cancelled".
  const result = await cancelListing({
    playerId:  "admin", // placeholder — force=true bypasses the ownership check
    hash:      listingId, // route [id] param is the public listing hash. §Phase 3
    force:     true,
  });

  switch (result.status) {
    case "ok":
      console.log(
        `[admin/marketplace/remove] Listing ${listingId} force-cancelled. ` +
          `Asset: ${result.assetName} (${result.assetType}). Reason: ${reason}`,
      );
      return Response.json({
        ok:        true,
        listingId: result.listingId,
        assetType: result.assetType,
        assetName: result.assetName,
        ...(result.quantityReturned !== undefined
          ? { quantityReturned: result.quantityReturned }
          : {}),
        reason,
      });

    case "listing-not-found":
      return Response.json({ error: "Listing not found" }, { status: 404 });

    case "listing-not-active":
      return Response.json(
        { error: "Listing is not active — already resolved" },
        { status: 409 },
      );

    case "asset-reservation-missing":
      // Non-fatal: the asset reservation was already consumed (race with purchase).
      // The listing is still marked cancelled; log for investigation.
      console.warn(
        `[admin/marketplace/remove] Listing ${listingId} reservation was already missing ` +
          `during force-cancel. Possible concurrent purchase.`,
      );
      return Response.json({
        ok:      true,
        listingId,
        warning: "Asset reservation was already missing — possible concurrent purchase",
        reason,
      });

    default:
      return Response.json({ error: "Unexpected error", detail: result.status }, { status: 500 });
  }
}

/**
 * GET /api/admin/economy-stats
 *
 * Admin-auth guarded endpoint returning Phase 3 economy KPIs. §3.5-C
 *
 * Auth: requires the `x-admin-secret` request header to match the
 * ADMIN_SECRET environment variable. This is intentionally simple —
 * a dedicated admin role on the JWT should replace it in Phase 4.
 *
 * Returns: TreasuryHealth (see lib/modules/game-stats/treasury.server.ts)
 *
 * Reference: docs/implementation_plans/phase-03-quest-system.md §3.5-C
 */

import { headers } from "next/headers";
import { getTreasuryHealth } from "@/lib/modules/game-stats/treasury.server";

export async function GET() {
  // --- Admin auth ---
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    // If ADMIN_SECRET is not configured, block access entirely.
    return Response.json(
      { error: "Admin endpoint not configured" },
      { status: 503 },
    );
  }

  const headerStore = await headers();
  const provided = headerStore.get("x-admin-secret");

  if (!provided || provided !== adminSecret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Fetch KPIs ---
  try {
    const health = await getTreasuryHealth();
    return Response.json(health);
  } catch (err) {
    console.error("[admin/economy-stats] Failed to fetch treasury health:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

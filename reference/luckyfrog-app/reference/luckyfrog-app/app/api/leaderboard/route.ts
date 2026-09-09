/**
 * GET /api/leaderboard — Deprecated (Mining removed in Phase 2)
 *
 * The mining leaderboard has been removed from the game.
 * This endpoint returns 410 Gone.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Mining and mining leaderboard have been removed from the game.", code: "GONE" },
    { status: 410 }
  );
}

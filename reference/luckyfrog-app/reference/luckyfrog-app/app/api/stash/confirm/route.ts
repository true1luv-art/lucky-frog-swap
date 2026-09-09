/**
 * POST /api/stash/confirm — Deprecated (Mining removed in Phase 2)
 *
 * Mining and stashing have been removed from the game.
 * This endpoint returns 410 Gone.
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Mining and stash mechanics have been removed from the game.", code: "GONE" },
    { status: 410 }
  );
}

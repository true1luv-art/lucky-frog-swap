/**
 * POST /api/claim
 *
 * REMOVED — Phase 2 of docs/game-cleanup-plan.md.
 * Mining claims have been removed from the game.
 * This route returns 410 Gone so any stale client calls receive a clear signal.
 */

export async function POST() {
  return Response.json(
    { error: "Mining claims have been removed. This endpoint is no longer available.", code: "GONE" },
    { status: 410 },
  );
}

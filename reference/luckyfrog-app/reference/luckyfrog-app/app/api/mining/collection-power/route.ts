/**
 * GET /api/mining/collection-power
 *
 * REMOVED — Phase 2 of docs/game-cleanup-plan.md.
 * Mining and collection-power have been removed from the game.
 * This route returns 410 Gone so any stale client calls receive a clear signal.
 */

export async function GET() {
  return Response.json(
    { error: "Mining has been removed. This endpoint is no longer available.", code: "GONE" },
    { status: 410 },
  );
}

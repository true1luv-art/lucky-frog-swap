/**
 * POST /api/quests/[id]/complete — removed.
 * The quest system has been removed from the game.
 */
export async function POST() {
  return Response.json(
    { success: false, error: "The quest system has been removed.", code: "REMOVED" },
    { status: 404 },
  );
}

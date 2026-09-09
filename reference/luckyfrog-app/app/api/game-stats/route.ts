/**
 * GET /api/game-stats
 *
 * Returns the singleton game_stats document for display on the landing page.
 * Includes lifetime HFARM emitted and quest completion totals.
 *
 * Cached with a 60-second revalidation.
 */

import { NextResponse } from "next/server";
import { getGameStats } from "@/lib/modules/game-stats/repository.server";
import { connectDatabase } from "@/lib/config/database";

export const revalidate = 60;

export async function GET() {
  try {
    await connectDatabase();
    const stats = await getGameStats();
    return NextResponse.json({
      totalHfarmEmitted:          stats.totalHfarmEmitted          ?? 0,
      totalDailyQuestsCompleted:  stats.totalDailyQuestsCompleted  ?? 0,
      totalWeeklyQuestsCompleted: stats.totalWeeklyQuestsCompleted ?? 0,
      updatedAt:                  stats.updatedAt ?? new Date(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to load game stats" }, { status: 500 });
  }
}

/**
 * GET /api/quests
 *
 * Quest board endpoint. §fold-quests / §3.2-D
 *
 * Returns the authenticated player's quest board (daily + weekly).
 * Village orders have been removed. §fold-quests design decision.
 *
 * Quests are now embedded on the farm document. This endpoint:
 *   1. Loads (or creates) the player's farm.
 *   2. Calls refreshQuestsIfStale — expired quests are replaced with fresh
 *      ones in the same request. No cron, no background job.
 *   3. Returns the fresh embedded quests.
 *
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "daily":  [ EmbeddedQuest × 6 ],
 *   "weekly": [ EmbeddedQuest × 1 ]
 * }
 * ```
 *
 * Auth: Bearer token or lfrg_token cookie.
 */

import { getWallet }              from "@/lib/api/get-wallet";
import { apiError, apiOk }        from "@/lib/api/error-response";
import { findPlayerByWallet }     from "@/lib/modules/players/service.server";
import { getOrCreateFarm, refreshQuestsIfStale } from "@/lib/modules/farms/service.server";
import { generateDailyQuests, generateWeeklyQuest } from "@/shared/quests/engine";

export async function GET(req: Request) {
  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  const wallet = await getWallet(req);
  if (!wallet) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  // ---------------------------------------------------------------------------
  // Fetch player (needed for skill levels)
  // ---------------------------------------------------------------------------
  const player = await findPlayerByWallet(wallet);
  if (!player) {
    return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
  }

  // ---------------------------------------------------------------------------
  // Load farm and lazily refresh quests
  // ---------------------------------------------------------------------------
  const farm = await getOrCreateFarm(wallet);

  const skills = player.skills ?? {
    farming: 0, mining: 0, woodcutting: 0,
    fishing: 0, cooking: 0, crafting: 0,
    husbandry: 0, combat: 0,
  };

  const quests = await refreshQuestsIfStale(
    wallet,
    farm,
    {
      generateDailyQuests: (s) => Promise.resolve(generateDailyQuests(s)),
      generateWeeklyQuest: (s) => Promise.resolve(generateWeeklyQuest(s)),
    },
    skills,
  );

  return apiOk({
    daily:  quests.daily,
    weekly: quests.weekly,
  });
}

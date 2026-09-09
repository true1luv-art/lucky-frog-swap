/**
 * lib/modules/farms/service.server.ts
 *
 * Public API for the farms domain.
 * Owns the quest-staleness check and regeneration orchestration.
 * All DB access is delegated to repository.server.ts.
 *
 * External callers (routes, lib/services files) must import from here —
 * never from repository.server.ts directly.
 */

import {
  getFarm,
  getOrCreateFarm,
  upsertFarm,
  patchFarm,
  createInitialFarm,
  deleteFarm,
  saveQuests,
  completeQuestOnFarm,
} from "./repository.server";
import type { IFarm } from "./types.server";
import type { EmbeddedQuest } from "@/shared/types/quests";
import type { PlayerSkills } from "@/shared/types/players";

export {
  getFarm,
  getOrCreateFarm,
  upsertFarm,
  patchFarm,
  createInitialFarm,
  deleteFarm,
  completeQuestOnFarm,
};

// ---------------------------------------------------------------------------
// Quest staleness check + regeneration
// ---------------------------------------------------------------------------

/**
 * Lazily expires stale quests and generates fresh ones when needed.
 *
 * Called at the top of GET /api/farm and GET /api/quests so every farm read
 * returns an up-to-date quest board with no background job.
 *
 * @param wallet       - Player wallet address.
 * @param farm         - Current lean farm document.
 * @param generators   - Injected quest-engine functions (avoids circular imports).
 * @param playerSkills - Player skills used by the generators.
 * @returns            - Up-to-date embedded quests (freshly persisted if changed).
 */
export async function refreshQuestsIfStale(
  wallet: string,
  farm: IFarm,
  generators: {
    generateDailyQuests: (skills: PlayerSkills) => Promise<EmbeddedQuest[]>;
    generateWeeklyQuest: (skills: PlayerSkills) => Promise<EmbeddedQuest>;
  },
  playerSkills: PlayerSkills,
): Promise<{ daily: EmbeddedQuest[]; weekly: EmbeddedQuest[] }> {
  const now = Date.now();
  let changed = false;

  // Coerce existing quests from the lean document (may be plain objects).
  let daily: EmbeddedQuest[] = (farm.quests?.daily ?? []) as EmbeddedQuest[];
  let weekly: EmbeddedQuest[] = (farm.quests?.weekly ?? []) as EmbeddedQuest[];

  // Daily: stale when empty or any quest's expiresAt has passed.
  const dailyExpired = daily.length === 0 || daily.some((q) => now > q.expiresAt);
  if (dailyExpired) {
    daily = await generators.generateDailyQuests(playerSkills);
    changed = true;
  }

  // Weekly: stale when empty or the single quest has expired.
  const weeklyExpired = weekly.length === 0 || weekly.some((q) => now > q.expiresAt);
  if (weeklyExpired) {
    weekly = [await generators.generateWeeklyQuest(playerSkills)];
    changed = true;
  }

  // Persist only when something actually changed.
  if (changed) {
    await saveQuests(wallet, { daily, weekly });
  }

  return { daily, weekly };
}

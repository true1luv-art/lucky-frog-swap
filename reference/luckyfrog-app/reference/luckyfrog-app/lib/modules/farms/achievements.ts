/**
 * lib/modules/farms/achievements.ts
 *
 * Server-side achievement checker. §2.5-C
 *
 * After every farm action, `checkAndGrantAchievements()` is called with the
 * new game state. It scans all ACHIEVEMENTS definitions and, for each that:
 *   1. Has not yet been claimed (not in `state.achievements`).
 *   2. Has its `requires` chain satisfied.
 *   3. Has `progress(state) >= requirement`.
 *
 * ...it stamps the achievement with the current Unix ms timestamp.
 *
 * Achievements are badges only — no coins, items, or experience are granted.
 * The function returns the updated GameState with any new achievements applied.
 * The caller (`persistFarmChanges`) will then diff + persist the changes.
 *
 * Design notes:
 * - Hidden achievements "Night Owl" and "Speed Farmer" have `progress: () => 0`
 *   and can never be auto-triggered server-side; they are intentionally skipped.
 */

import {
  ACHIEVEMENTS,
  type AchievementName,
} from "@/shared/types/gameplay/achievements";
import type { GameState } from "@/shared/types/gameplay/game";

/**
 * Iterates all achievement definitions against the current game state,
 * stamps any newly-met achievements, and returns the updated state.
 *
 * Called once per `POST /api/farm/action` after the action is applied.
 * Idempotent: already-claimed achievements are skipped.
 * No rewards are applied — achievements are badges only.
 */
export function checkAndGrantAchievements(state: GameState): GameState {
  let s = state;

  for (const [name, achievement] of Object.entries(ACHIEVEMENTS) as [AchievementName, typeof ACHIEVEMENTS[AchievementName]][]) {
    // Already claimed — skip
    if (s.achievements?.[name]) continue;

    // Prerequisite chain — all listed achievements must be claimed first
    if (achievement.requires) {
      const prereqsMet = achievement.requires.every(
        (req) => !!(s.achievements?.[req]),
      );
      if (!prereqsMet) continue;
    }

    // Progress check
    let progressValue: number;
    try {
      progressValue = achievement.progress(s);
    } catch {
      // Some hidden achievements may throw on certain states; skip safely.
      continue;
    }

    if (progressValue < achievement.requirement) continue;

    // Stamp the achievement — no rewards applied
    s = {
      ...s,
      achievements: { ...s.achievements, [name]: Date.now() },
    };
  }

  return s;
}

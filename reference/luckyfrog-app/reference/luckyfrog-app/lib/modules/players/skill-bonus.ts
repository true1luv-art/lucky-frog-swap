/**
 * lib/modules/players/skill-bonus.ts
 *
 * Pure server-side port of phaser/game/lib/skills.ts `computeBonus()`. §2.5-B
 *
 * The Phaser `computeBonus()` already has no DOM/Phaser dependencies — it is a
 * pure function that maps skill XP totals to a `SkillBonus` record. This file
 * re-exports it from a clean server path so server-only code can import it
 * without coupling to the `phaser/` directory boundary indirectly.
 *
 * Additionally exposes `shouldRecomputeBonus()`, which determines whether a
 * skill level milestone was just crossed (every 10 levels). The route handler
 * calls this after any XP-granting action to decide whether to run a full
 * `computeBonus` and write the result back to the player document.
 *
 * Design:
 * - Sprint 2.5 stores the computed bonus inside the `GameState` (it is already
 *   there as `state.bonus`). The persisted form is the player document's
 *   `skillBonus` field (added in this sprint). The route writes the updated
 *   bonus whenever a milestone is crossed, so each subsequent request can read
 *   it back via `buildServerGameState`.
 *
 * Reference: docs/implementation_plans/phase-02-farming-backend.md §2.5-B
 */

import type { PlayerSkills, SkillBonus } from "@/shared/types/gameplay/skills";
import { computeBonus as phaserComputeBonus } from "@/shared/game/skills";
import { getSkillLevel } from "@/shared/game/skills";

/**
 * Computes the `SkillBonus` from a set of skill XP totals.
 * Direct re-export of the Phaser pure function — no server-specific logic here.
 * Kept in this module so server code has a single import path. §2.5-B
 */
export function computeBonus(skills: PlayerSkills): SkillBonus {
  return phaserComputeBonus(skills);
}

/**
 * Returns true when adding `xpDelta` to a skill's current XP causes the skill
 * level to cross a milestone (every 10 levels). §2.5-B
 *
 * Trigger recompute only on milestone crossings to avoid running `computeBonus`
 * on every single action (expensive for frequent actions like harvesting).
 *
 * @param currentXP  - Skill XP before this action.
 * @param xpDelta    - XP being added by this action.
 */
export function shouldRecomputeBonus(
  currentXP: number,
  xpDelta:   number,
): boolean {
  if (xpDelta <= 0) return false;
  const oldLevel = getSkillLevel(currentXP);
  const newLevel = getSkillLevel(currentXP + xpDelta);
  if (newLevel === oldLevel) return false;
  // Milestone every 10 levels
  for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
    if (lvl % 10 === 0) return true;
  }
  return false;
}

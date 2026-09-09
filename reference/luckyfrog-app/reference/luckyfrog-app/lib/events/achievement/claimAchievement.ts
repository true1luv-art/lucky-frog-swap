import { GameState } from "@/shared/types/gameplay/game";
import { AchievementName, ACHIEVEMENTS } from "@/shared/types/gameplay/achievements";

export type ClaimAchievementAction = {
  type: "achievement.claimed";
  achievement: AchievementName;
};

type Options = {
  state:      GameState;
  action:     ClaimAchievementAction;
  createdAt?: number;
};

export enum CLAIM_ACHIEVEMENT_ERRORS {
  NOT_FOUND        = "Achievement does not exist",
  ALREADY_CLAIMED  = "Achievement already claimed",
  NOT_MET          = "Achievement requirements not met",
  PREREQUISITE_NOT_MET = "Achievement prerequisite not met",
}

/**
 * Pure GameState reducer: marks an achievement as claimed at `createdAt`.
 *
 * Validates:
 *  - The achievement name exists in ACHIEVEMENTS.
 *  - It has not already been claimed on this state.
 *  - All `requires` prerequisites have already been claimed.
 *  - The player's current progress meets or exceeds the requirement.
 */
export function claimAchievement({
  state,
  action,
  createdAt = Date.now(),
}: Options): GameState {
  const def = ACHIEVEMENTS[action.achievement];
  if (!def) throw new Error(CLAIM_ACHIEVEMENT_ERRORS.NOT_FOUND);

  if (state.achievements[action.achievement] !== undefined) {
    throw new Error(CLAIM_ACHIEVEMENT_ERRORS.ALREADY_CLAIMED);
  }

  // Check prerequisites
  for (const prereq of def.requires ?? []) {
    if (state.achievements[prereq] === undefined) {
      throw new Error(CLAIM_ACHIEVEMENT_ERRORS.PREREQUISITE_NOT_MET);
    }
  }

  // Check progress
  if (def.progress(state) < def.requirement) {
    throw new Error(CLAIM_ACHIEVEMENT_ERRORS.NOT_MET);
  }

  return {
    ...state,
    achievements: {
      ...state.achievements,
      [action.achievement]: createdAt,
    },
  };
}

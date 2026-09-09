/**
 * Public API for the game-stats domain. Lifetime LFRG emission is the source of
 * truth for automatic halving; database access remains in repository.server.ts.
 */

import {
  getGameStats,
  initGameStats,
  incrementLfrgEmitted,
  creditTreasury,
  deductTreasury,
  incrementQuestsCompleted,
} from "./repository.server";
import {
  getCurrentHalvingStep,
  getEmissionProgress,
  getNextHalvingThreshold,
} from "./halving";

export {
  getGameStats,
  initGameStats,
  incrementLfrgEmitted,
  creditTreasury,
  deductTreasury,
  incrementQuestsCompleted,
};

export async function getHalvingState() {
  const stats = await getGameStats();
  const step = getCurrentHalvingStep(stats.totalLfrgEmitted);

  return {
    totalLfrgEmitted: stats.totalLfrgEmitted,
    stage: step.stage,
    emissionMultiplier: step.emissionMultiplier,
    label: step.label,
    currentMilestone: step.startsAt,
    nextMilestone: getNextHalvingThreshold(stats.totalLfrgEmitted),
    ...getEmissionProgress(stats.totalLfrgEmitted),
  };
}

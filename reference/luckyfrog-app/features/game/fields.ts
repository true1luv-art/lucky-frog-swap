/**
 * features/game/fields.ts
 *
 * Farm-plot unlock requirements.
 *
 * 72 plots (plotIndex 0–71) across 3 zones of 24, gated by farmLevel.
 *
 * Zone A  — plotIndex  0–23  — farmLevel ≥ 1  (always available)
 * Zone B  — plotIndex 24–47  — farmLevel ≥ 2
 * Zone C  — plotIndex 48–71  — farmLevel ≥ 6
 *
 * Single source of truth; both `isFieldUnlocked` (client) and
 * `serverPlant` (server) call into this file.
 */

import { getPlotFarmLevelRequirement, isPlotUnlocked } from "@/features/game/farm-level";

/** Total number of farm plots (plotIndex 0 … TOTAL_FIELDS-1). */
export const TOTAL_FIELDS = 72;

/**
 * Returns the minimum farm level required to plant on `fieldIndex`.
 */
export function getFieldLevelRequirement(fieldIndex: number): number {
  return getPlotFarmLevelRequirement(fieldIndex);
}

/**
 * Returns true when the player's farm level meets the requirement for `fieldIndex`.
 *
 * Note: `farmLevel` parameter is now farm level (1–10), not farming skill level.
 * Call sites inside `serverPlant` and `plant.ts` pass `state.farmLevel`.
 */
export function isFieldUnlocked(fieldIndex: number, farmLevel: number): boolean {
  return isPlotUnlocked(fieldIndex, farmLevel);
}

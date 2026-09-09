import { FishName } from "@/features/types/gameplay/fish";

/**
 * Base fishing action duration before skill bonuses (ms).
 * Player must wait this long from lastCastAt before claiming fish reward.
 */
export const FISHING_ACTION_MS = 60_000;

/** Minimum fishing action duration with all bonuses applied (ms). */
export const FISHING_MIN_ACTION_MS = 20_000;

export type FishEntry = {
  name: FishName;
  weight: number;
  minLevel: number;
};

/**
 * Single fish type. All prior variants are abolished.
 * Players always catch "Fish" regardless of fishing level.
 */
export const FISH_TABLE: FishEntry[] = [
  { name: "Fish", weight: 100, minLevel: 0 },
];

export function rollCatch(_fishingLevel: number): FishName {
  return "Fish";
}

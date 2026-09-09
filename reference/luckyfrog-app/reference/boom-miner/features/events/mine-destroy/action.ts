/**
 * features/events/mine-destroy/action.ts
 *
 * Pure event function — no DB, no side effects.
 * Handles the moment a node's hp reaches 0, branching on node.kind:
 *   - "chest" → earns the full coinReward
 *   - "bush"  → earns 0 coins (bushes are obstacles, not treasure)
 *
 * Called internally by mineHit when newHp === 0. Can also be called
 * directly in tests to verify the reward logic in isolation.
 */

import type { MapNodeSnapshot } from "@/features/mine-action/types";

export type MineDestroyAction =
  | { type: "chest.destroyed"; nodeKey: string }
  | { type: "bush.destroyed";  nodeKey: string };

export interface DestroyResult {
  /** Coins credited to the player from this destroy event. */
  coinsEarned: number;
  /** Discriminant used by the client to play the correct animation. */
  eventType: "chest.destroyed" | "bush.destroyed";
}

/**
 * Derive the destroy result for a node that just reached hp === 0.
 * The caller is responsible for passing the correct action.type
 * (already known from node.kind at the call site in mineHit).
 */
export function mineDestroy({
  node,
  action,
}: {
  node: MapNodeSnapshot;
  action: MineDestroyAction;
}): DestroyResult {
  if (node.kind === "chest") {
    return {
      coinsEarned: node.coinReward,
      eventType:   "chest.destroyed",
    };
  }

  // Bush: obstacle only, no coin reward.
  return {
    coinsEarned: 0,
    eventType:   "bush.destroyed",
  };
}

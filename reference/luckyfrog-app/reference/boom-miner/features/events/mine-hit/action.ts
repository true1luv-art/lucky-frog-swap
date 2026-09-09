/**
 * features/events/mine-hit/action.ts
 *
 * Pure event function — no DB, no side effects.
 * Validates a single bomb hit and computes the next MineState.
 * When a node reaches hp === 0 it delegates to mineDestroy to
 * determine the correct reward and event type.
 *
 * Pattern: robinhood-farm/features/events/chop/chop.ts
 */

import type { MineState, HitResult } from "@/features/mine-action/types";
import { mineDestroy } from "@/features/events/mine-destroy/action";

export interface MineHitAction {
  type: "node.hit";
  heroId:  string;
  nodeKey: string;
}

export function mineHit({
  state,
  action,
  createdAt = Date.now(),
}: {
  state:     MineState;
  action:    MineHitAction;
  createdAt?: number;
}): HitResult {
  const fail = (error: string, code: string): HitResult => ({
    ok: false, error, code, coinsEarned: 0, destroyed: false, stageComplete: false,
  });

  const { heroId, nodeKey } = action;

  // Reject replay/flood attempts before deriving any rewards or energy changes.
  if (state.lastActionAt > 0 && createdAt - state.lastActionAt < 800) {
    return fail("Hits must be at least 800 ms apart", "HIT_TOO_FAST");
  }

  // --- Hero must be deployed ---
  const hero = state.heroes[heroId];
  if (!hero) {
    return fail("Hero is not on the map", "HERO_NOT_ON_MAP");
  }

  // --- Hero must have energy ---
  if (hero.currentEnergy < 1) {
    return fail("Hero has no energy", "INSUFFICIENT_ENERGY");
  }

  // --- Node must exist and be alive ---
  const node = state.nodes[nodeKey];
  if (!node || node.destroyed) {
    return fail("Node does not exist or is already destroyed", "NODE_GONE");
  }

  // --- Apply hit ---
  const newHp    = Math.max(0, node.hp - 1);
  const destroyed = newHp === 0;

  // Determine coins + eventType (only on destroy, via mineDestroy).
  let coinsEarned = 0;
  let eventType: "chest.destroyed" | "bush.destroyed" | undefined;

  if (destroyed) {
    const destroyAction =
      node.kind === "chest"
        ? ({ type: "chest.destroyed", nodeKey } as const)
        : ({ type: "bush.destroyed",  nodeKey } as const);
    const dr = mineDestroy({ node, action: destroyAction });
    coinsEarned = dr.coinsEarned;
    eventType   = dr.eventType;
  }

  const newState: MineState = {
    ...state,
    coins:          state.coins + coinsEarned,
    lastActionAt:   createdAt,
    destroyedNodes: state.destroyedNodes + (destroyed ? 1 : 0),
    heroes: {
      ...state.heroes,
      [heroId]: { ...hero, currentEnergy: hero.currentEnergy - 1 },
    },
    nodes: {
      ...state.nodes,
      [nodeKey]: { ...node, hp: newHp, destroyed },
    },
  };

  // Stage is complete when every node (chest + bush) is destroyed.
  const stageComplete = newState.destroyedNodes >= newState.totalNodes;

  return {
    ok: true,
    newState,
    coinsEarned,
    destroyed,
    stageComplete,
    eventType,
  };
}

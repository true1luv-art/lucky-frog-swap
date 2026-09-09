/**
 * features/events/farm-upgrade/farmUpgrade.ts
 *
 * Handles the "farm.upgrade" action: increments farmLevel by 1 and
 * deducts the LFRG token cost from state.coins.
 *
 * Validation:
 *  1. farmLevel must be below MAX_FARM_LEVEL (10).
 *  2. totalSkillXp must meet the threshold for the next level.
 *  3. state.coins must be >= lfrgCost (passed in from server — computed from
 *     the live on-chain pair price at the time the player initiates upgrade).
 *
 * On success:
 *  - farmLevel += 1
 *  - state.coins -= lfrgCost
 */

import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay/game";
import {
  MAX_FARM_LEVEL,
  FARM_LEVEL_UPGRADES,
  totalSkillXp,
} from "@/features/game/farm-level";

export type FarmUpgradeAction = {
  type: "farm.upgrade";
  /** LFRG token cost at the time of upgrade (integer, from /api/price/lfrg). */
  lfrgCost: number;
};

type Options = { state: GameState; action: FarmUpgradeAction };

export function farmUpgrade({ state, action }: Options): GameState {
  const current = state.farmLevel ?? 1;

  if (current >= MAX_FARM_LEVEL) {
    throw new Error("Farm is already at max level");
  }

  const target = current + 1;
  const cost   = FARM_LEVEL_UPGRADES[target];
  if (!cost) throw new Error(`No upgrade cost defined for Farm Level ${target}`);

  // XP threshold check
  const xpTotal = totalSkillXp(state.skills);
  if (xpTotal < cost.xpRequired) {
    throw new Error(
      `Need ${cost.xpRequired.toLocaleString()} total skill XP to reach Farm Level ${target} (you have ${xpTotal.toLocaleString()})`,
    );
  }

  // Coins (LFRG) check — state.coins is a Decimal
  const currentCoins = new Decimal(state.coins ?? 0);
  const lfrgCost     = new Decimal(action.lfrgCost);

  if (currentCoins.lt(lfrgCost)) {
    throw new Error(`Not enough $LFRG tokens (need ${action.lfrgCost}, have ${currentCoins.toNumber()})`);
  }

  return {
    ...state,
    farmLevel: target,
    coins:     currentCoins.sub(lfrgCost),
  };
}

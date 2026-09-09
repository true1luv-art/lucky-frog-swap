/**
 * features/events/craft-coal/craftCoal.ts
 *
 * Craft Coal at the Blacksmith Smelt tab.
 * Recipe: 2 Wood → 1 Coal (30 s cooldown, 125 smithing XP per action).
 */

import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay/game";
import { getSkillXP } from "@/features/game/skills";

export const COAL_WOOD_COST    = 2; // Wood per 1 Coal
export const COAL_SMELT_TIMER  = 30; // seconds cooldown

export type CraftCoalAction = {
  type: "coal.crafted";
  /** Number of Coal to craft (each costs 2 Wood). */
  amount: number;
};

type Options = { state: GameState; action: CraftCoalAction };

export function craftCoal({ state, action }: Options): GameState {
  if (action.amount < 1) throw new Error("Invalid amount");

  const woodNeeded = action.amount * COAL_WOOD_COST;
  const woodHave   = new Decimal(state.items.Wood ?? 0);
  if (woodHave.lessThan(woodNeeded)) {
    throw new Error(`Not enough Wood (need ${woodNeeded}, have ${woodHave.toNumber()})`);
  }

  const coalHave  = new Decimal(state.items.Coal ?? 0);
  const nextItems = {
    ...state.items,
    Wood: woodHave.sub(woodNeeded),
    Coal: coalHave.add(action.amount),
  };
  const newSmithingXP = (state.skills.smithing ?? 0) + getSkillXP("smith_action");

  return {
    ...state,
        items: nextItems, // alias
    skills: { ...state.skills, smithing: newSmithingXP },
  };
}

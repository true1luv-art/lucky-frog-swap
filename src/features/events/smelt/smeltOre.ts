/**
 * features/events/smelt/smeltOre.ts
 *
 * Smelt ore into ingots at the Blacksmith Smelt tab.
 * Recipe: 10 Ore + 1 Coal → 1 Ingot (30 s cooldown, 125 smithing XP per action).
 */

import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay/game";
import type { OreType, ResourceName } from "@/features/types/gameplay/resources";
import { getSkillXP } from "@/features/game/skills";

export const SMELT_ORE_PER_INGOT   = 10; // Ore per 1 Ingot
export const SMELT_COAL_PER_INGOT  = 1;  // Coal per 1 Ingot
export const SMELT_TIMER_SECONDS   = 30; // seconds cooldown

export type SmeltOreAction = {
  type: "ore.smelted";
  ore: OreType;
  /** Number of ingots to smelt (each costs 10 Ore + 1 Coal). */
  amount: number;
};

/** Maps ore type to its corresponding ingot resource name. */
export const ORE_TO_INGOT: Record<OreType, ResourceName> = {
  Iron:     "Iron Ingot",
  Silver:   "Silver Ingot",
  Emerald:  "Emerald Ingot",
  Diamond:  "Diamond Ingot",
  Ignisite: "Ignisite Ingot",
};

type Options = { state: GameState; action: SmeltOreAction };

export function smeltOre({ state, action }: Options): GameState {
  if (action.amount < 1) throw new Error("Invalid amount");

  const ingotName  = ORE_TO_INGOT[action.ore];
  if (!ingotName) throw new Error(`Unknown ore type: "${action.ore}"`);

  const oreNeeded  = action.amount * SMELT_ORE_PER_INGOT;
  const coalNeeded = action.amount * SMELT_COAL_PER_INGOT;

  const oreHave  = new Decimal((state.items as Record<string, Decimal>)[action.ore] ?? 0);
  const coalHave = new Decimal(state.items.Coal ?? 0);

  if (oreHave.lessThan(oreNeeded)) {
    throw new Error(`Not enough ${action.ore} (need ${oreNeeded}, have ${oreHave.toNumber()})`);
  }
  if (coalHave.lessThan(coalNeeded)) {
    throw new Error(`Not enough Coal (need ${coalNeeded}, have ${coalHave.toNumber()})`);
  }

  const ingotHave      = new Decimal((state.items as Record<string, Decimal>)[ingotName] ?? 0);
  const newSmithingXP  = (state.skills.smithing ?? 0) + getSkillXP("smith_action");
  const nextItems      = {
    ...state.items,
    [action.ore]: oreHave.sub(oreNeeded),
    Coal:         coalHave.sub(coalNeeded),
    [ingotName]:  ingotHave.add(action.amount),
  };

  return {
    ...state,
        items: nextItems, // alias
    skills: { ...state.skills, smithing: newSmithingXP },
  };
}

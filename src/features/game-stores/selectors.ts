import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay";
import { getSkillLevel } from "@/features/game/skills";
import type { SkillCategory as SkillName } from "@/features/types/gameplay/skills";
import type { ToolInstance, ToolName } from "@/features/types/gameplay/tools";


/** Shard count from items. */
export function selectShards(state: GameState): number {
  const val = (state.items as Record<string, Decimal | undefined>)["Shard"];
  return val ? new Decimal(val).toNumber() : 0;
}

/** Quantity of any stackable item (returns 0 if not present). */
export function selectItemQty(state: GameState, item: string): number {
  const val = (state.items as Record<string, Decimal | undefined>)[item];
  if (!val) return 0;
  return new Decimal(val).toNumber();
}


/** All owned ToolInstance objects. */
export function selectTools(state: GameState): ToolInstance[] {
  return state.tools ?? [];
}

/** First tool instance with the given name, or undefined. */
export function selectTool(state: GameState, name: ToolName): ToolInstance | undefined {
  return (state.tools ?? []).find((t) => t.name === name);
}

/** Whether the player has a working tool of the given name (any tier). */
export function selectHasTool(state: GameState, name: ToolName): boolean {
  return (state.tools ?? []).some((t) => t.name === name);
}

/** Skill XP for a given skill name */
export function selectSkillXP(state: GameState, skill: SkillName): number {
  return (state.skills as Record<string, number | undefined>)[skill] ?? 0;
}

/** Skill level for a given skill */
export function selectSkillLevel(state: GameState, skill: SkillName): number {
  const xp = selectSkillXP(state, skill);
  return getSkillLevel(xp);
}

/** All fields */
export function selectFields(state: GameState) {
  return state.fields;
}

/** All trees */
export function selectTrees(state: GameState) {
  return state.trees;
}

/** All stone nodes */
export function selectStones(state: GameState) {
  return state.stones;
}

/** All chickens */
export function selectChickens(state: GameState) {
  return state.chickens;
}

/** All cows */
export function selectCows(state: GameState) {
  return state.cows;
}

/** All sheep */
export function selectSheep(state: GameState) {
  return state.sheep;
}

/** Whether player has a fishing rod (Rod tool in tools[]). */
export function selectHasFishingRod(state: GameState): boolean {
  return selectHasTool(state, "Rod");
}

/** Whether player has an axe (Axe tool in tools[]). */
export function selectHasAxe(state: GameState): boolean {
  return selectHasTool(state, "Axe");
}

/** Whether player has a watering can (Watering Can tool in tools[]). */
export function selectHasWateringCan(state: GameState): boolean {
  return selectHasTool(state, "Watering Can");
}

/** Fishing state */
export function selectFishing(state: GameState) {
  return state.fishing;
}

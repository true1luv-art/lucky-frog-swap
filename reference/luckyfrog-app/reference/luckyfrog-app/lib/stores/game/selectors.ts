import Decimal from "decimal.js-light";
import type { GameState } from "@/shared/types/gameplay";
import { getSkillLevel } from "@/shared/game/skills";
import type { SkillCategory as SkillName } from "@/shared/types/gameplay/skills";

/** Current stamina value (0–100) */
export function selectStamina(state: GameState): number {
  return state.stamina.current;
}

/** Max stamina */
export function selectMaxStamina(state: GameState): number {
  return state.stamina.max;
}

/** SFL balance as a JS number */
export function selectBalance(state: GameState): number {
  return new Decimal(state.balance).toNumber();
}

/** Inventory quantity of any item (returns 0 if not present) */
export function selectInventoryQty(state: GameState, item: string): number {
  const val = (state.inventory as Record<string, Decimal | undefined>)[item];
  if (!val) return 0;
  return new Decimal(val).toNumber();
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

/** Whether stamina is full */
export function selectIsStaminaFull(state: GameState): boolean {
  return state.stamina.current >= state.stamina.max;
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

/** All iron nodes */
export function selectIron(state: GameState) {
  return state.iron;
}

/** All gold nodes */
export function selectGold(state: GameState) {
  return state.gold;
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

/** Current cooking slot */
export function selectCooking(state: GameState) {
  return state.cooking;
}

/** Whether player has a fishing rod */
export function selectHasFishingRod(state: GameState): boolean {
  const qty = (state.inventory as Record<string, Decimal | undefined>)["fishing_rod"];
  return qty ? new Decimal(qty).gt(0) : false;
}

/** Whether player has an axe */
export function selectHasAxe(state: GameState): boolean {
  const qty = (state.inventory as Record<string, Decimal | undefined>)["axe"];
  return qty ? new Decimal(qty).gt(0) : false;
}

/** Active achievements */
export function selectAchievements(state: GameState) {
  return state.achievements;
}

/** Fishing state */
export function selectFishing(state: GameState) {
  return state.fishing;
}

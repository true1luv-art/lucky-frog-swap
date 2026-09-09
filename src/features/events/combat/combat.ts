import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay/game";
import { getMaxHp } from "@/features/game/hp";
import { BOW_TIER, BOW_TIER_ORDER, type BowTier } from "@/features/game/bow";
import { ENEMY_CONFIG, type EnemyType } from "@/features/game/enemies";
import { getSkillLevel } from "@/features/game/skills";

export type PlayerHurtAction = { type: "player.hurt"; damage: number };
export type PlayerDiedAction = { type: "player.died" };
export type EnemyDefeatedAction = {
  type: "enemy.defeated";
  enemyId: string;
  enemyType: EnemyType;
};
export type BowUpgradeAction = { type: "bow.upgrade"; tier: BowTier };
export type BowEquipAction = { type: "bow.equip"; equipped: boolean };

function maxHpOf(state: GameState): number {
  return getMaxHp(getSkillLevel(state.skills?.cooking ?? 0));
}

/** Apply enemy damage to the player. HP never goes below 0. */
export function playerHurt({
  state,
  action,
}: { state: GameState; action: PlayerHurtAction }): GameState {
  const damage = Math.max(0, Math.round(action.damage));
  const current = state.hp ?? maxHpOf(state);
  return { ...state, hp: Math.max(0, current - damage) };
}

/**
 * Death: refill HP and pay a small gold tax (10%, minimum 5).
 * Inventory and skills are untouched — death is a setback, not a reset.
 */
export function playerDied({ state }: { state: GameState }): GameState {
  const coins = state.coins ?? new Decimal(0);
  const tenPercent = coins.mul(0.1);
  const raw = tenPercent.greaterThan(5) ? tenPercent : new Decimal(5);
  const tax = raw.greaterThan(coins) ? coins : raw;
  return { ...state, hp: maxHpOf(state), coins: coins.sub(tax) };
}

/** Reward for killing an enemy. */
export function enemyDefeated({
  state,
  action,
}: { state: GameState; action: EnemyDefeatedAction }): GameState {
  const cfg = ENEMY_CONFIG[action.enemyType];
  if (!cfg) return state;
  return {
    ...state,
    coins: (state.coins ?? new Decimal(0)).add(cfg.goldDrop),
  };
}

/** Buy the next bow tier with gold. One tier at a time. */
export function bowUpgrade({
  state,
  action,
}: { state: GameState; action: BowUpgradeAction }): GameState {
  const currentIndex = BOW_TIER_ORDER.indexOf(state.bowTier ?? "Wood");
  const nextIndex = BOW_TIER_ORDER.indexOf(action.tier);
  if (nextIndex !== currentIndex + 1) {
    throw new Error("Can only upgrade one bow tier at a time");
  }
  const cost = new Decimal(BOW_TIER[action.tier].goldCost);
  const coins = state.coins ?? new Decimal(0);
  if (coins.lessThan(cost)) throw new Error("Not enough gold");
  // Keep the inventory Bow tool in step with the purchased tier so the
  // hotbar icon reflects the upgrade.
  const tools = (state.tools ?? []).map((tool) =>
    tool.name === "Bow" ? { ...tool, tier: action.tier } : tool,
  );
  return { ...state, coins: coins.sub(cost), bowTier: action.tier, tools };
}

/** Equip / unequip the bow. Only an equipped bow can be aimed and fired. */
export function bowEquip({
  state,
  action,
}: { state: GameState; action: BowEquipAction }): GameState {
  return { ...state, bowEquipped: action.equipped };
}

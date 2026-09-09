import { Crop } from "@/shared/types/gameplay/crops";
import { Inventory } from "@/shared/types/gameplay/game";
import type { SkillBonus } from "@/shared/types/gameplay/skills";

export const getSellPrice = (crop: Crop, _inventory: Inventory) => crop.sellPrice;
export const hasSellBoost = (_inventory: Inventory) => false;

export function getReducedDuration(baseDuration: number, reduction: number): number {
  return Math.max(0, baseDuration * Math.max(0, 1 - reduction));
}

export function getRoundedReducedDuration(baseDuration: number, reduction: number): number {
  return Math.round(getReducedDuration(baseDuration, reduction));
}

export function getSnapshotTimestamp(
  createdAt: number,
  baseDuration: number,
  reduction: number,
): number {
  return createdAt - (baseDuration - getReducedDuration(baseDuration, reduction));
}

function applyYield(base: number, bonusRate: number): number {
  return Math.floor(base * (1 + bonusRate));
}

export function getWoodYield(base: number, bonus: SkillBonus): number  { return applyYield(base, bonus.woodYield); }
export function getWoodRecoveryMultiplier(bonus: SkillBonus): number   { return Math.max(0, 1 - bonus.woodRecovery); }
export function rollWoodDouble(bonus: SkillBonus): boolean             { return Math.random() < bonus.woodDouble; }

export function getOreYield(base: number, bonus: SkillBonus): number   { return applyYield(base, bonus.oreYield); }
export function getOreRecoveryMultiplier(bonus: SkillBonus): number    { return Math.max(0, 1 - bonus.oreRecovery); }
export function rollOreDouble(bonus: SkillBonus): boolean              { return Math.random() < bonus.oreDouble; }

export function getCropYield(base: number, bonus: SkillBonus): number  { return applyYield(base, bonus.cropYield); }
export function getCropSpeedMultiplier(bonus: SkillBonus): number      { return Math.max(0, 1 - bonus.cropSpeed); }
export function rollCropDouble(bonus: SkillBonus): boolean             { return Math.random() < bonus.cropDouble; }

export function getProduceYield(base: number, bonus: SkillBonus): number  { return applyYield(base, bonus.produceYield); }
export function getProduceSpeedMultiplier(bonus: SkillBonus): number      { return Math.max(0, 1 - bonus.produceSpeed); }
export function rollProduceDouble(bonus: SkillBonus): boolean             { return Math.random() < bonus.produceDouble; }

export function getStaminaYield(base: number, bonus: SkillBonus): number  { return applyYield(base, bonus.staminaYield); }
export function getCookingSpeedMultiplier(bonus: SkillBonus): number      { return Math.max(0, 1 - bonus.cookingSpeed); }
export function rollCookingDouble(bonus: SkillBonus): boolean             { return Math.random() < bonus.cookingDouble; }

export function getDamageMultiplier(bonus: SkillBonus): number  { return 1 + bonus.damageBonus; }
export function getDefenseMultiplier(bonus: SkillBonus): number { return 1 + bonus.defenseBonus; }
export function getDodgeMultiplier(bonus: SkillBonus): number   { return 1 + bonus.dodgeBonus; }
export function getCritChance(bonus: SkillBonus): number        { return bonus.critChance; }

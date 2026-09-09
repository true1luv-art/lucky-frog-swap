import type { PlayerSkills, SkillBonus } from "@/shared/types/gameplay/skills";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

const BASE_XP = 500;
const MAX_SKILL_LEVEL = 100;

export function xpForNextLevel(level: number): number {
  return Math.round(BASE_XP + 350 * (level - 1) + 25 * (level - 1) * (level - 1));
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpForNextLevel(i);
  return total;
}

export function getSkillLevel(totalXP: number): number {
  let level = 1;
  let needed = 0;
  while (level < MAX_SKILL_LEVEL) {
    needed += xpForNextLevel(level);
    if (needed > totalXP) break;
    level++;
  }
  return level;
}

export const getSkillXPForLevel = totalXpForLevel;

export function getSkillXPToNextLevel(totalXP: number): number {
  const level = getSkillLevel(totalXP);
  if (level >= MAX_SKILL_LEVEL) return 0;
  return xpForNextLevel(level) - (totalXP - totalXpForLevel(level));
}

export function getSkillProgress(totalXP: number): number {
  const level = getSkillLevel(totalXP);
  if (level >= MAX_SKILL_LEVEL) return 1;
  const levelStartXP = totalXpForLevel(level);
  return Math.min((totalXP - levelStartXP) / xpForNextLevel(level), 1);
}

export const SKILL_XP = {
  chop_tree:                  25,
  mine_stone:                 60,
  mine_iron:                 100,
  mine_gold:                 150,
  harvest_potato:             10,
  harvest_carrot:             15,
  harvest_cabbage:            20,
  harvest_pumpkin:            25,
  harvest_beetroot:           35,
  harvest_parsnip:            45,
  harvest_radish:             55,
  harvest_cauliflower:        70,
  harvest_wheat:              90,
  harvest_kale:              120,
  craft_roasted_potato:       25,
  craft_carrot_stew:          35,
  craft_cabbage_roll:         40,
  craft_pumpkin_soup:         50,
  craft_beetroot_salad:       60,
  craft_parsnip_porridge:     70,
  craft_radish_skewers:       80,
  craft_cauliflower_sandwich: 90,
  craft_wheat_bread:         100,
  craft_kale_stirfry:        120,
  collect_egg:                30,
  collect_milk:               50,
  collect_wool:               50,
  catch_fish:                 35,
} as const;

export type SkillXPAction = keyof typeof SKILL_XP;

export function getSkillXP(action: SkillXPAction): number {
  return SKILL_XP[action] ?? 0;
}

export function getHarvestXP(cropName: string): number {
  const key = `harvest_${cropName.toLowerCase()}` as SkillXPAction;
  return SKILL_XP[key] ?? 10;
}

export function getCookXP(foodName: string): number {
  const key = `craft_${foodName.toLowerCase().replace(/[\s-]/g, "_")}` as SkillXPAction;
  return SKILL_XP[key] ?? 0;
}

export function computeBonus(skills: PlayerSkills): SkillBonus {
  const bonus = { ...INITIAL_BONUS };
  const f  = getSkillLevel(skills.woodcutting);
  const m  = getSkillLevel(skills.mining);
  const fa = getSkillLevel(skills.farming);
  const h  = getSkillLevel(skills.husbandry);
  const fi = getSkillLevel(skills.fishing);
  const c  = getSkillLevel(skills.cooking);
  const co = getSkillLevel(skills.combat);

  if (f >= 10)  bonus.woodYield    += 0.10;
  if (f >= 20)  bonus.woodYield    += 0.10;
  if (f >= 30)  bonus.woodRecovery += 0.10;
  if (f >= 40)  bonus.woodYield    += 0.10;
  if (f >= 50)  bonus.woodRecovery += 0.10;
  if (f >= 60)  bonus.woodYield    += 0.10;
  if (f >= 70)  bonus.woodRecovery += 0.10;
  if (f >= 80)  bonus.woodYield    += 0.10;
  if (f >= 90)  bonus.woodRecovery += 0.10;
  if (f >= 100) { bonus.woodYield += 0.25; bonus.woodDouble += 0.15; }

  if (m >= 10)  bonus.oreYield    += 0.10;
  if (m >= 20)  bonus.oreYield    += 0.10;
  if (m >= 30)  bonus.oreRecovery += 0.10;
  if (m >= 40)  bonus.oreYield    += 0.10;
  if (m >= 50)  bonus.oreDouble   += 0.10;
  if (m >= 60)  bonus.oreRecovery += 0.10;
  if (m >= 70)  bonus.oreYield    += 0.20;
  if (m >= 80)  bonus.oreRecovery += 0.10;
  if (m >= 90)  bonus.oreDouble   += 0.10;
  if (m >= 100) { bonus.oreYield += 0.25; bonus.oreRecovery += 0.10; }

  if (fa >= 10)  bonus.cropSpeed  += 0.05;
  if (fa >= 20)  bonus.cropSpeed  += 0.05;
  if (fa >= 30)  bonus.cropYield  += 0.10;
  if (fa >= 40)  bonus.cropSpeed  += 0.05;
  if (fa >= 50)  bonus.cropYield  += 0.10;
  if (fa >= 60)  bonus.cropSpeed  += 0.05;
  if (fa >= 70)  bonus.cropDouble += 0.10;
  if (fa >= 80)  bonus.cropYield  += 0.15;
  if (fa >= 90)  bonus.cropSpeed  += 0.05;
  if (fa >= 100) { bonus.cropYield += 0.15; bonus.cropDouble += 0.10; }

  if (h >= 10)  bonus.produceSpeed  += 0.10;
  if (h >= 20)  bonus.produceSpeed  += 0.10;
  if (h >= 30)  bonus.produceYield  += 0.10;
  if (h >= 40)  bonus.produceSpeed  += 0.10;
  if (h >= 50)  bonus.produceDouble += 0.10;
  if (h >= 60)  bonus.produceYield  += 0.10;
  if (h >= 70)  bonus.produceSpeed  += 0.10;
  if (h >= 80)  bonus.produceYield  += 0.10;
  if (h >= 90)  bonus.produceDouble += 0.10;
  if (h >= 100) { bonus.produceSpeed += 0.10; bonus.produceYield += 0.20; }

  if (fi >= 10)  bonus.fishYield  += 0.10;
  if (fi >= 20)  bonus.fishYield  += 0.10;
  if (fi >= 30)  bonus.fishSpeed  += 0.10;
  if (fi >= 40)  bonus.fishYield  += 0.10;
  if (fi >= 50)  bonus.fishDouble += 0.10;
  if (fi >= 60)  bonus.fishSpeed  += 0.10;
  if (fi >= 70)  bonus.fishYield  += 0.20;
  if (fi >= 80)  bonus.fishSpeed  += 0.10;
  if (fi >= 90)  bonus.fishDouble += 0.10;
  if (fi >= 100) { bonus.fishYield += 0.25; bonus.fishDouble += 0.15; }

  if (c >= 10)  bonus.staminaYield  += 0.10;
  if (c >= 20)  bonus.staminaYield  += 0.10;
  if (c >= 30)  bonus.cookingDouble += 0.05;
  if (c >= 40)  bonus.staminaYield  += 0.10;
  if (c >= 50)  bonus.cookingSpeed  += 0.10;
  if (c >= 60)  bonus.cookingDouble += 0.05;
  if (c >= 70)  bonus.staminaYield  += 0.10;
  if (c >= 80)  bonus.cookingSpeed  += 0.10;
  if (c >= 90)  bonus.cookingDouble += 0.10;
  if (c >= 100) { bonus.staminaYield += 0.10; bonus.cookingSpeed += 0.10; }

  if (co >= 10)  bonus.damageBonus  += 0.05;
  if (co >= 20)  bonus.defenseBonus += 0.05;
  if (co >= 30)  bonus.dodgeBonus   += 0.05;
  if (co >= 40)  bonus.damageBonus  += 0.05;
  if (co >= 50)  bonus.critChance   += 0.05;
  if (co >= 60)  bonus.defenseBonus += 0.05;
  if (co >= 70)  bonus.damageBonus  += 0.05;
  if (co >= 80)  bonus.dodgeBonus   += 0.05;
  if (co >= 90)  bonus.critChance   += 0.05;
  if (co >= 100) { bonus.damageBonus += 0.05; bonus.critChance += 0.05; }

  return bonus;
}

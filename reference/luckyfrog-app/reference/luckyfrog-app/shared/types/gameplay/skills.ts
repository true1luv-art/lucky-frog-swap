// §C5 — Updated to canonical server names; §5.8 marks combat as inactive
export type SkillCategory =
  | "farming"
  | "woodcutting"
  | "mining"
  | "fishing"
  | "cooking"
  | "combat"
  | "husbandry";

export type PlayerSkills = Record<SkillCategory, number>;

export const INITIAL_SKILLS: PlayerSkills = {
  farming:     0,
  woodcutting: 0,
  mining:      0,
  fishing:     0,
  cooking:     0,
  combat:      0,  // inactive (stored XP only; no bonuses, §5.8)
  husbandry:   0,
};

export type SkillBonus = {
  // Woodcutting
  woodYield:      number;
  woodRecovery:   number;
  woodDouble:     number;
  // Mining
  oreYield:       number;
  oreRecovery:    number;
  oreDouble:      number;
  // Farming
  cropYield:      number;
  cropSpeed:      number;
  cropDouble:     number;
  // Husbandry
  produceYield:   number;
  produceSpeed:   number;
  produceDouble:  number;
  // Fishing
  fishYield:      number;
  fishSpeed:      number;
  fishDouble:     number;
  // Cooking
  staminaYield:   number;
  cookingSpeed:   number;
  cookingDouble:  number;
  // Combat
  damageBonus:    number;
  defenseBonus:   number;
  dodgeBonus:     number;
  critChance:     number;
};

export const INITIAL_BONUS: SkillBonus = {
  woodYield: 0, woodRecovery: 0, woodDouble: 0,
  oreYield: 0, oreRecovery: 0, oreDouble: 0,
  cropYield: 0, cropSpeed: 0, cropDouble: 0,
  produceYield: 0, produceSpeed: 0, produceDouble: 0,
  fishYield: 0, fishSpeed: 0, fishDouble: 0,
  staminaYield: 0, cookingSpeed: 0, cookingDouble: 0,
  damageBonus: 0, defenseBonus: 0, dodgeBonus: 0, critChance: 0,
};

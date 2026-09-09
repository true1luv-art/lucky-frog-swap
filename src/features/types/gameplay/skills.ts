export type SkillCategory =
  | "farming"
  | "woodcutting"
  | "mining"
  | "fishing"
  | "husbandry"
  | "cooking"
  | "smithing";

export type PlayerSkills = Record<SkillCategory, number>;

export const INITIAL_SKILLS: PlayerSkills = {
  farming:     0,
  woodcutting: 0,
  mining:      0,
  fishing:     0,
  husbandry:   0,
  cooking:     0,
  smithing:    0,
};



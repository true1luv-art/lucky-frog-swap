const BASE_LEVEL_EXPERIENCE = 500;

export function experienceForNextLevel(level: number): number {
  return Math.round(BASE_LEVEL_EXPERIENCE + 350 * (level - 1) + 25 * (level - 1) * (level - 1));
}

export function totalExperienceForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) total += experienceForNextLevel(i);
  return total;
}

export function getLevelFromExperience(totalXP: number): number {
  let level = 1;
  let xpNeeded = 0;
  while (xpNeeded <= totalXP) {
    xpNeeded += experienceForNextLevel(level);
    if (xpNeeded <= totalXP) level++;
  }
  return level;
}

export function getLevelProgress(totalXP: number): number {
  const currentLevel = getLevelFromExperience(totalXP);
  const currentLevelXP = totalExperienceForLevel(currentLevel);
  const nextLevelXP = experienceForNextLevel(currentLevel);
  return Math.min((totalXP - currentLevelXP) / nextLevelXP, 1);
}

export function getXPToNextLevel(totalXP: number): number {
  const currentLevel = getLevelFromExperience(totalXP);
  const currentLevelXP = totalExperienceForLevel(currentLevel);
  return experienceForNextLevel(currentLevel) - (totalXP - currentLevelXP);
}

// 72 plots (fieldIndex 0–71), laid out as 12 rows of 6. Unlock ramps from
// level 0 up to level 25 — the final row unlocks at level 25, so ALL plots are
// available once the player reaches Farming Level 25. Must stay in sync with the
// shared source in shared/data/farming.ts.
export const FIELD_LEVEL_REQUIREMENTS: Record<number, number> = {
  0: 0,   1: 0,   2: 0,   3: 0,   4: 0,   5: 0,   // row 1  — always unlocked
  6: 2,   7: 2,   8: 2,   9: 2,   10: 2,  11: 2,  // row 2  — level 2
  12: 4,  13: 4,  14: 4,  15: 4,  16: 4,  17: 4,  // row 3  — level 4
  18: 6,  19: 6,  20: 6,  21: 6,  22: 6,  23: 6,  // row 4  — level 6
  24: 8,  25: 8,  26: 8,  27: 8,  28: 8,  29: 8,  // row 5  — level 8
  30: 10, 31: 10, 32: 10, 33: 10, 34: 10, 35: 10, // row 6  — level 10
  36: 12, 37: 12, 38: 12, 39: 12, 40: 12, 41: 12, // row 7  — level 12
  42: 14, 43: 14, 44: 14, 45: 14, 46: 14, 47: 14, // row 8  — level 14
  48: 16, 49: 16, 50: 16, 51: 16, 52: 16, 53: 16, // row 9  — level 16
  54: 18, 55: 18, 56: 18, 57: 18, 58: 18, 59: 18, // row 10 — level 18
  60: 21, 61: 21, 62: 21, 63: 21, 64: 21, 65: 21, // row 11 — level 21
  66: 25, 67: 25, 68: 25, 69: 25, 70: 25, 71: 25, // row 12 — level 25
};

/** Total number of farm plots (fieldIndex 0 … TOTAL_FIELDS-1). Matches PLOT_POSITIONS. */
export const TOTAL_FIELDS = 72;

export function getFieldLevelRequirement(fieldIndex: number): number {
  return FIELD_LEVEL_REQUIREMENTS[fieldIndex] ?? 0;
}

export function isFieldUnlocked(fieldIndex: number, playerLevel: number): boolean {
  return playerLevel >= getFieldLevelRequirement(fieldIndex);
}

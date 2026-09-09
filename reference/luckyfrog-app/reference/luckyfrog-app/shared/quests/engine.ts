/** Pure quest generation and selection helpers. */

import { getSkillLevel } from "@/shared/data/farming";
import {
  BASE_ROLLS,
  DAILY_QUEST_CATEGORIES,
  GUARANTEED_SHARDS,
  GUARANTEED_SKILL_XP,
  QUEST_OBJECTIVES,
  difficultyForSkillLevel,
} from "@/shared/data/quests";
import type { PlayerSkills } from "@/shared/types/players";
import type {
  EmbeddedQuest,
  QuestCategory,
  QuestDifficulty,
} from "@/shared/types/quests";

function questId(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

function tomorrowMidnightUTC(): number {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.getTime();
}

function nextMondayMidnightUTC(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const date = new Date(now);
  date.setUTCDate(now.getUTCDate() + daysToNextMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function getSkillXpForCategory(skills: PlayerSkills, category: QuestCategory): number {
  return (skills as unknown as Record<string, number>)[category] ?? 0;
}

function highestSkillCategory(skills: PlayerSkills): QuestCategory {
  const categories = [...DAILY_QUEST_CATEGORIES] as QuestCategory[];
  let best = categories[0];
  let bestLevel = getSkillLevel(getSkillXpForCategory(skills, best));

  for (const category of categories.slice(1)) {
    const level = getSkillLevel(getSkillXpForCategory(skills, category));
    if (level > bestLevel) {
      bestLevel = level;
      best = category;
    }
  }

  return best;
}

function buildEmbeddedQuest(
  category: QuestCategory,
  difficulty: QuestDifficulty,
  expiresAt: number,
  now: number,
): EmbeddedQuest {
  const template = QUEST_OBJECTIVES[category][difficulty];
  return {
    id: questId(),
    category,
    difficulty,
    status: "active",
    objective: { resource: template.resource, required: template.baseRequired },
    rewards: {
      guaranteedShards: GUARANTEED_SHARDS[difficulty],
      skillXp: GUARANTEED_SKILL_XP[difficulty],
      baseRolls: BASE_ROLLS[difficulty],
    },
    generatedAt: now,
    expiresAt,
  };
}

export function generateDailyQuests(playerSkills: PlayerSkills): EmbeddedQuest[] {
  const expiresAt = tomorrowMidnightUTC();
  const now = Date.now();

  return DAILY_QUEST_CATEGORIES.map((category) => {
    const level = getSkillLevel(getSkillXpForCategory(playerSkills, category));
    return buildEmbeddedQuest(category, difficultyForSkillLevel(level), expiresAt, now);
  });
}

export function generateWeeklyQuest(playerSkills: PlayerSkills): EmbeddedQuest {
  const category = highestSkillCategory(playerSkills);
  const level = getSkillLevel(getSkillXpForCategory(playerSkills, category));
  const rawDifficulty = difficultyForSkillLevel(level);
  const difficulty: QuestDifficulty =
    rawDifficulty === "easy" || rawDifficulty === "normal" ? "hard" : rawDifficulty;

  return buildEmbeddedQuest(category, difficulty, nextMondayMidnightUTC(), Date.now());
}

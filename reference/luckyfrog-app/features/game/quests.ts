/**
 * shared/game/quests.ts
 *
 * Quest system configuration.
 *
 * Economy Redesign:
 *   - Farming resource pool now contains shop-only crops.
 *     Quest crops (Radish, Cauliflower, Wheat, Kale) are REWARDS, not objectives.
 *     Players cannot be asked to turn in items they can only get from quests.
 *   - Mining pool covers the minable ore tiers (Stone/Iron/Emerald/Diamond/Ignisite).
 *     Gold is NOT minable — it is a quest-only reward currency, never an objective.
 *   - Cooking pool covers the basic cooked foods (quest-crop dishes excluded, since
 *     those require items only obtainable from quests).
 *   - Quest rewards now include:
 *       seedReward  — quest-exclusive seed (farming quests, normal tier and above)
 *       goldReward  — Gold currency (all categories, scales with difficulty)
 *
 * Quest tier → seed reward mapping:
 *   normal  → Radish Seed
 *   hard    → Cauliflower Seed
 *   expert  → Wheat Seed
 *   master  → Kale Seed
 *
 * Note: "master" difficulty is a new tier above "expert" introduced in Phase 1.
 * The QuestDifficulty type in features/types/quests.ts needs "master" added when
 * Phase 4 (Gold system) is implemented fully.
 */

import type { PlayerSkills } from "@/features/types/players";
import type { QuestCategory, QuestDifficulty, EmbeddedQuest } from "@/features/types/quests";

// ---------------------------------------------------------------------------
// Daily quest categories
// ---------------------------------------------------------------------------

export const DAILY_QUEST_CATEGORIES: readonly QuestCategory[] = [
  "farming",
  "mining",
  "woodcutting",
  "fishing",
  "husbandry",
  "cooking",
] as const;

// ---------------------------------------------------------------------------
// Resource pools — obtainable items per category
// ---------------------------------------------------------------------------

export const QUEST_RESOURCE_POOLS: Record<QuestCategory, readonly string[]> = {
  /**
   * Farming pool: shop crops only.
   * Quest crops (Radish, Cauliflower, Wheat, Kale) are rewards, not objectives.
   */
  farming: [
    "Potato",
    "Carrot",
    "Cabbage",
    "Pumpkin",
    "Beetroot",
    "Parsnip",
  ],
  /**
   * Mining pool: the minable ore tiers.
   * Gold is excluded — it is a quest reward currency, not a minable objective.
   */
  mining: [
    "Stone",
    "Iron",
    "Emerald",
    "Diamond",
    "Ignisite",
  ],
  woodcutting: [
    "Wood",
  ],
  fishing: [
    "Anchovy",
    "Sardine",
    "Tilapia",
    "Herring",
    "Trout",
    "Sea Bass",
    "Mackerel",
    "Salmon",
    "Red Snapper",
    "Barracuda",
    "Tuna",
    "Swordfish",
    "Blue Marlin",
    "Oarfish",
  ],
  husbandry: [
    "Egg",
    "Milk",
    "Wool",
  ],
  /**
   * Cooking pool: basic cooked dishes.
   * Quest-crop dishes (Radish Skewers, Cauliflower Sandwich, Wheat Bread,
   * Kale Stir-fry) are excluded — they need crops only obtainable from quests.
   */
  cooking: [
    "Roasted Potato",
    "Carrot Stew",
    "Cabbage Roll",
    "Pumpkin Soup",
    "Beetroot Salad",
    "Parsnip Porridge",
  ],
};

// ---------------------------------------------------------------------------
// Quest amount and reward bands — scale with raw skill XP
// ---------------------------------------------------------------------------

export interface QuestAmountBand {
  /** Upper bound of XP for this band (Infinity for the last band). */
  maxXp:      number;
  /** Midpoint quantity — final value is rolled ± 25% of this. */
  baseQty:    number;
  difficulty: QuestDifficulty;
  skillXp:    number;
  /** Gold rewarded on completion. Scales with difficulty. */
  goldReward: number;
}

export const QUEST_AMOUNT_BANDS: QuestAmountBand[] = [
  { maxXp:    499, baseQty:  15, difficulty: "easy",   skillXp:   50, goldReward: 0 },
  { maxXp:  4_999, baseQty:  35, difficulty: "normal", skillXp:  150, goldReward: 1 },
  { maxXp: 24_999, baseQty:  80, difficulty: "hard",   skillXp:  400, goldReward: 3 },
  { maxXp: Infinity, baseQty: 150, difficulty: "expert", skillXp: 1000, goldReward: 8 },
];

// ---------------------------------------------------------------------------
// Farming quest seed rewards — tier → seed name
// Only farming quests reward seeds. Other categories reward Gold only.
// ---------------------------------------------------------------------------

export const FARMING_SEED_REWARDS: Record<Exclude<QuestDifficulty, "easy">, string> = {
  normal: "Radish Seed",
  hard:   "Cauliflower Seed",
  expert: "Wheat Seed",
  // Note: "master" tier (Kale Seed) to be added when QuestDifficulty type is extended in Phase 4.
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function bandForXp(xp: number): QuestAmountBand {
  return QUEST_AMOUNT_BANDS.find((b) => xp <= b.maxXp) ?? QUEST_AMOUNT_BANDS[QUEST_AMOUNT_BANDS.length - 1];
}

export function rollRequired(xp: number, rng: () => number = Math.random): number {
  const { baseQty } = bandForXp(xp);
  const factor = 0.75 + rng() * 0.5;
  return Math.max(1, Math.round(baseQty * factor));
}

export function rollResource(
  category: QuestCategory,
  rng: () => number = Math.random,
): string {
  const pool = QUEST_RESOURCE_POOLS[category];
  return pool[Math.floor(rng() * pool.length)];
}

// ---------------------------------------------------------------------------
// Quest generation
// ---------------------------------------------------------------------------

function questId(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

function tomorrowMidnightUTC(): number {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.getTime();
}

function skillXpForCategory(skills: PlayerSkills, category: QuestCategory): number {
  return skills[category as keyof PlayerSkills] ?? 0;
}

function buildEmbeddedQuest(
  category:  QuestCategory,
  xp:        number,
  expiresAt: number,
  now:       number,
): EmbeddedQuest {
  const band     = bandForXp(xp);
  const resource = rollResource(category);
  const required = rollRequired(xp);

  // Seed reward: only for farming quests at normal difficulty and above.
  const seedReward =
    category === "farming" && band.difficulty !== "easy"
      ? FARMING_SEED_REWARDS[band.difficulty as Exclude<QuestDifficulty, "easy">]
      : undefined;

  // Gold reward: all categories, zero for easy tier.
  const goldReward = band.goldReward > 0 ? band.goldReward : undefined;

  return {
    id:         questId(),
    category,
    difficulty: band.difficulty,
    status:     "active",
    objective:  { resource, required },
    rewards: {
      skillXp: band.skillXp,
      seedReward,
      goldReward,
    },
    generatedAt: now,
    expiresAt,
  };
}

/**
 * Generate one daily quest per category, scaled to the player's current skill XP.
 */
export function generateDailyQuests(playerSkills: PlayerSkills): EmbeddedQuest[] {
  const expiresAt = tomorrowMidnightUTC();
  const now       = Date.now();

  return DAILY_QUEST_CATEGORIES.map((category) => {
    const xp = skillXpForCategory(playerSkills, category);
    return buildEmbeddedQuest(category, xp, expiresAt, now);
  });
}

export type QuestCategory =
  | "farming"
  | "mining"
  | "woodcutting"
  | "fishing"
  | "husbandry"
  | "cooking";

export type QuestDifficulty = "easy" | "normal" | "hard" | "expert";
export type QuestStatus = "active" | "completed" | "expired";

/** A single quest embedded directly on the farm document. */
export interface EmbeddedQuest {
  id: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  status: QuestStatus;
  objective: { resource: string; required: number };
  rewards: {
    skillXp: number;
    /**
     * Quest-exclusive seed awarded on completion.
     * Only farming quests at normal tier and above reward a seed.
     * The seed name matches a CropName + " Seed" and is quest-gated.
     */
    seedReward?: string;
    /**
     * Gold awarded on completion.
     * Gold is the only in-game currency with a real-world value path.
     * Amount scales with difficulty tier.
     */
    goldReward?: number;
  };
  generatedAt: number;
  expiresAt: number;
  completedAt?: number;
}


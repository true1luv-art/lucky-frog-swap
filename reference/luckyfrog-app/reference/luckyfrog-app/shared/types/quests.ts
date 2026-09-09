export type QuestCategory =
  | "farming"
  | "mining"
  | "woodcutting"
  | "fishing"
  | "cooking"
  | "husbandry";

export type QuestDifficulty = "easy" | "normal" | "hard" | "expert";
export type QuestStatus = "active" | "completed" | "expired";

export interface FrogmentRollResult {
  roll: number;
  amount: number;
  jackpot?: boolean;
}

/** A single quest embedded directly on the farm document. */
export interface EmbeddedQuest {
  id: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  status: QuestStatus;
  objective: { resource: string; required: number };
  rewards: {
    guaranteedShards: Array<{ amount: number }>;
    skillXp: number;
    baseRolls: number;
  };
  generatedAt: number;
  expiresAt: number;
  completedAt?: number;
  rollResults?: FrogmentRollResult[];
}

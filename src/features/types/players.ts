export interface PlayerSkills {
  farming: number;
  mining: number;
  woodcutting: number;
  fishing: number;
  husbandry: number;
  cooking: number;
  smithing: number;
}

export interface CreatePlayerInput {
  wallet: string;
  username?: string;
  referrer?: string;
}

export interface UpdatePlayerStateInput {
  username?: string;
  skills?: Partial<PlayerSkills>;
}

/**
 * Aggregate combat stats — sum of all currently equipped item bonuses.
 * Cached on the player document for fast profile reads.
 */
export interface PlayerStats {
  attack:  number;
  defense: number;
  luck:    number;
  speed:   number;
  crit:    number;
}

export const INITIAL_PLAYER_STATS: PlayerStats = {
  attack: 0, defense: 0, luck: 0, speed: 0, crit: 0,
};

export interface PlayerDTO {
  wallet: string;
  username?: string;
  registrationTime: number;
  referrer?: string;
  skills: PlayerSkills;
  /** Aggregate combat stats from equipped gear. */
  stats: PlayerStats;
  /** Recipes unlocked by the player. Defaults to ["Baked Potato", "Cooked Fish"]. */
  unlockedRecipes: string[];
  /** Lifetime milestone counters. Moved from farm document. */
  milestones: Record<string, number>;
}

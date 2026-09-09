export interface PlayerSkills {
  farming: number;
  mining: number;
  woodcutting: number;
  fishing: number;
  cooking: number;
  crafting: number;
  husbandry: number;
  combat: number;
}

export interface PlayerStats {
  luck: number;
  dodge: number;
  crit: number;
  damage: number;
  defense: number;
}

export interface CreatePlayerInput {
  wallet: string;
  username?: string;
  referrer?: string;
}

export interface UpdatePlayerStateInput {
  username?: string;
  lfrg?: number;
  charm?: number;
  stash?: number;
  stats?: Partial<PlayerStats>;
  stakedFrogs?: string[];
  avatarFrogId?: string;
  skills?: Partial<PlayerSkills>;
}

export interface PlayerDTO {
  wallet: string;
  username?: string;
  lfrg: number;
  charm: number;
  stash: number;
  stats: PlayerStats;
  registrationTime: number;
  referrer?: string;
  stakedFrogs: string[];
  avatarFrogId?: string;
  skills: PlayerSkills;
}

/** Pure animation frame-data. No scene.load.* calls here. */
export interface AnimationDefinition {
  key: string
  texture: string
  /** Frames per row (a 4-row sheet has this many frames per direction). */
  frames: number
  frameRate: number
  repeat: number
  /**
   * Number of direction rows in the sheet. 4 = up / down / left / right,
   * 1 = a single strip that is used for every direction.
   */
  rows?: number
  skipMissedFrames?: boolean
}

/**
 * Player uses the 80×80 character pack. Every sheet has 4 rows:
 * row 0 back (up), row 1 front (down), row 2 left, row 3 right.
 */
export const PLAYER_ANIMS: AnimationDefinition[] = [
  { key: 'player_idle',    texture: 'player_idle',    frames: 6,  frameRate: 6,  repeat: -1, rows: 4 },
  { key: 'player_walk',    texture: 'player_walk',    frames: 6,  frameRate: 8,  repeat: -1, rows: 4 },
  { key: 'player_mine',    texture: 'player_mine',    frames: 10, frameRate: 10, repeat:  0, rows: 4 },
  { key: 'player_axe',     texture: 'player_axe',     frames: 10, frameRate: 10, repeat:  0, rows: 4 },
  { key: 'player_doing',   texture: 'player_doing',   frames: 18, frameRate: 18, repeat:  0, rows: 4 },
  { key: 'player_casting', texture: 'player_casting', frames: 15, frameRate: 15, repeat:  0, rows: 4 },
  { key: 'player_caught',  texture: 'player_caught',  frames: 10, frameRate: 10, repeat:  0, rows: 4 },
]

export const PLAYER_SUPPORT_ANIMS: AnimationDefinition[] = [
  { key: 'player_bow',     texture: 'player_bow',     frames: 6,  frameRate: 12, repeat: 0,  rows: 4 },
  { key: 'player_sword',   texture: 'player_sword',   frames: 9,  frameRate: 14, repeat: 0,  rows: 4 },
  { key: 'player_waiting', texture: 'player_fishidle', frames: 10, frameRate: 10, repeat: -1, rows: 4 },
  { key: 'player_reeling', texture: 'player_reel',     frames: 10, frameRate: 10, repeat: 0,  rows: 4 },
  { key: 'player_shovel',  texture: 'player_shovel',   frames: 13, frameRate: 13, repeat: 0,  rows: 4 },
  { key: 'player_hammer',  texture: 'player_hammer',   frames: 20, frameRate: 20, repeat: 0,  rows: 4 },
  { key: 'player_damage',  texture: 'player_damage',   frames: 8,  frameRate: 8,  repeat: 0,  rows: 4 },
  { key: 'player_watering',texture: 'player_watering', frames: 5,  frameRate: 8,  repeat: 0,  rows: 4 },
  // death_strip14 is a single-row strip.
  { key: 'player_death',   texture: 'player_death',    frames: 14, frameRate: 14, repeat: 0,  rows: 1 },
]

export const NPC_ANIMS: AnimationDefinition[] = [
  { key: 'npc_idle', texture: 'npc_base', frames: 6, frameRate: 6, repeat: -1, rows: 4 },
  { key: 'npc_rancher_idle', texture: 'npc_rancher', frames: 6, frameRate: 6, repeat: -1, rows: 4 },
  { key: 'npc_trader_idle', texture: 'npc_trader', frames: 6, frameRate: 6, repeat: -1, rows: 4 },
  { key: 'npc_blacksmith_idle', texture: 'npc_blacksmith', frames: 20, frameRate: 20, repeat: -1, rows: 4 },
]

export const ANIMAL_ANIMS: AnimationDefinition[] = [
  { key: 'animal_chicken_walk', texture: 'animal_chicken', frames: 4, frameRate: 6, repeat: -1 },
  { key: 'animal_sheep_walk',   texture: 'animal_sheep',   frames: 4, frameRate: 6, repeat: -1 },
  { key: 'animal_cow_walk',     texture: 'animal_cow',     frames: 4, frameRate: 4, repeat: -1 },
]

export const RESOURCE_ANIMS: AnimationDefinition[] = [
  { key: 'drop_stone', texture: 'drop_stone', frames: 7, frameRate: 10, repeat: 0 },
  { key: 'drop_iron',  texture: 'drop_iron',  frames: 7, frameRate: 10, repeat: 0 },
  { key: 'drop_gold',  texture: 'drop_gold',  frames: 7, frameRate: 10, repeat: 0 },
  { key: 'drop_tree',  texture: 'drop_tree',  frames: 7, frameRate: 10, repeat: 0 },
]

/** Pure animation frame-data. No scene.load.* calls here. */
export interface AnimationDefinition {
  key: string
  texture: string
  frames: number
  frameRate: number
  repeat: number
}

export const PLAYER_ANIMS: AnimationDefinition[] = [
  { key: 'player_idle',    texture: 'player_idle',    frames: 9,  frameRate: 9,  repeat: -1 },
  { key: 'player_walk',    texture: 'player_walk',    frames: 8,  frameRate: 8,  repeat: -1 },
  { key: 'player_mine',    texture: 'player_mine',    frames: 10, frameRate: 10, repeat:  0 },
  { key: 'player_axe',     texture: 'player_axe',     frames: 10, frameRate: 10, repeat:  0 },
  { key: 'player_doing',   texture: 'player_doing',   frames: 8,  frameRate: 8,  repeat:  0 },
  { key: 'player_casting', texture: 'player_casting', frames: 15, frameRate: 10, repeat:  0 },
  { key: 'player_caught',  texture: 'player_caught',  frames: 10, frameRate: 10, repeat:  0 },
]

export const PLAYER_SUPPORT_ANIMS: AnimationDefinition[] = [
  { key: 'player_waiting', texture: 'player_idle', frames: 9, frameRate: 4, repeat: -1 },
  { key: 'player_reeling', texture: 'player_casting', frames: 15, frameRate: 10, repeat: 0 },
]

export const NPC_ANIMS: AnimationDefinition[] = [
  { key: 'npc_idle', texture: 'npc_base', frames: 9, frameRate: 6, repeat: -1 },
  { key: 'npc_rancher_idle', texture: 'npc_rancher', frames: 9, frameRate: 9, repeat: -1 },
  { key: 'npc_trader_idle', texture: 'npc_trader', frames: 9, frameRate: 9, repeat: -1 },
  { key: 'npc_blacksmith_idle', texture: 'npc_blacksmith', frames: 23, frameRate: 10, repeat: -1 },
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

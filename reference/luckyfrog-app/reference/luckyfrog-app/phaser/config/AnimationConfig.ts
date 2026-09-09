/** Pure animation frame-data. No scene.load.* calls here. */
export const PLAYER_ANIMS = [
  { key: 'player_idle',    texture: 'player_idle',    frames: 9,  frameRate: 9,  repeat: -1 },
  { key: 'player_walk',    texture: 'player_walk',    frames: 8,  frameRate: 8,  repeat: -1 },
  { key: 'player_mine',    texture: 'player_mine',    frames: 10, frameRate: 10, repeat:  0 },
  { key: 'player_axe',     texture: 'player_axe',     frames: 10, frameRate: 10, repeat:  0 },
  { key: 'player_doing',   texture: 'player_doing',   frames: 8,  frameRate: 8,  repeat:  0 },
  { key: 'player_waiting', texture: 'player_waiting', frames: 9,  frameRate: 6,  repeat: -1 },
  { key: 'player_casting', texture: 'player_casting', frames: 15, frameRate: 10, repeat:  0 },
  { key: 'player_reeling', texture: 'player_reeling', frames: 13, frameRate: 10, repeat:  0 },
  { key: 'player_caught',  texture: 'player_caught',  frames: 10, frameRate: 10, repeat:  0 },
]

export const NPC_ANIMS = [
  { key: 'npc_idle', texture: 'player_idle', frames: 9, frameRate: 6, repeat: -1 },
]

export const ANIMAL_ANIMS = [
  { key: 'animal_chicken_walk', texture: 'animal_chicken', frames: 4, frameRate: 6, repeat: -1 },
  { key: 'animal_sheep_walk',   texture: 'animal_sheep',   frames: 4, frameRate: 6, repeat: -1 },
  { key: 'animal_cow_walk',     texture: 'animal_cow',     frames: 4, frameRate: 4, repeat: -1 },
]

export const RESOURCE_ANIMS = [
  { key: 'drop_stone', texture: 'drop_stone', frames: 7, frameRate: 10, repeat: 0 },
  { key: 'drop_iron',  texture: 'drop_iron',  frames: 7, frameRate: 10, repeat: 0 },
  { key: 'drop_gold',  texture: 'drop_gold',  frames: 7, frameRate: 10, repeat: 0 },
  { key: 'drop_tree',  texture: 'drop_tree',  frames: 7, frameRate: 10, repeat: 0 },
]

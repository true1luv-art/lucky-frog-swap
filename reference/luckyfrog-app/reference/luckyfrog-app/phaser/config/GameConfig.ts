/**
 * GameConfig
 * Pure data constants for the phaserv1 engine.
 * No Phaser API calls. No imports from game code.
 */

export const GAME_CONFIG = {
  /** Tilemap world size in pixels (60 tiles × 16 px = 960px, 40 tiles × 16 px = 640px) */
  WIDTH:  960,
  HEIGHT: 640,

  BG_COLOR: "#1a1a1a",
  PIXEL_ART: true,

  /** Camera zoom level — 4× makes 16 px tiles render at 64 px (matches Hearthvale close-up look) */
  ZOOM: 4,

  /** Physics gravity (top-down = 0) */
  GRAVITY: { y: 0 },

  /** World tile size in pixels */
  TILE_SIZE: 16,

  /** Player sprite sheet frame dimensions */
  SPRITE_WIDTH:  96,
  SPRITE_HEIGHT: 64,

  /**
   * Player movement speed in px/s.
   * 100 px/s matches the hearthvale default (WIDTH / 8).
   */
  PLAYER_SPEED: 100,

  /**
   * Proximity interaction range in tiles.
   * 1 = ±1 tile in each direction → 3×3 grid.
   */
  INTERACTION_RADIUS_TILES: 1,

  /**
   * Building interaction radius in tiles.
   * 3 = ±3 tiles → 7×7 grid around the player.
   */
  BUILDING_INTERACTION_RADIUS_TILES: 3,
} as const;

/** NPC sprite config — NPCs use the human idle spritesheet (players are frogs) */
export const NPC_CONFIG = {
  textureKey: 'npc_base',
  animKey:    'npc_idle',
  depth:      18,
} as const

export const PLAYER_CONFIG = {
  /** Arcade physics body dimensions — tight hitbox centred on the feet */
  BODY_SIZE:   { width: 10, height: 10 },
  BODY_OFFSET: { x: 43,    y: 27     },
} as const;

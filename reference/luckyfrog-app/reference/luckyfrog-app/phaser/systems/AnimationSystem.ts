import type Phaser from 'phaser'

interface AnimConf {
  key:       string
  texture?:  string
  frames:    { start: number; end: number }
  frameRate: number
  repeat:    number
}

// ── Config ────────────────────────────────────────────────────────────────────
// Frog sprites ship idle / walk / mining / axe / doing / casting / caught strips.
// Waiting reuses the casting "line-out" hold frames; reeling reuses the caught strip.

const PLAYER_CONFIG = {
  IDLE:    { key: 'player_idle',    texture: 'player_idle',   frames: { start: 0, end: 8  }, frameRate: 6,  repeat: -1 },
  WALK:    { key: 'player_walk',    texture: 'player_walk',   frames: { start: 0, end: 7  }, frameRate: 8,  repeat: -1 },
  MINE:    { key: 'player_mine',    texture: 'player_mine',   frames: { start: 0, end: 9  }, frameRate: 10, repeat: 0  },
  AXE:     { key: 'player_axe',     texture: 'player_axe',    frames: { start: 0, end: 9  }, frameRate: 10, repeat: 0  },
  DOING:   { key: 'player_doing',   texture: 'player_doing',  frames: { start: 0, end: 7  }, frameRate: 8,  repeat: 0  },
  WAITING: { key: 'player_waiting', texture: 'player_casting',frames: { start: 13, end: 14 }, frameRate: 4, repeat: -1 },
} as const

const FISHING_CONFIG = {
  CASTING: { key: 'player_casting', texture: 'player_casting', frames: { start: 0, end: 14 }, frameRate: 10, repeat: 0 },
  REELING: { key: 'player_reeling', texture: 'player_caught',  frames: { start: 0, end: 9  }, frameRate: 10, repeat: 0 },
  CAUGHT:  { key: 'player_caught',  texture: 'player_caught',  frames: { start: 0, end: 9  }, frameRate: 10, repeat: 0 },
} as const

const NPC_CONFIG = {
  IDLE: { key: 'npc_idle', texture: 'npc_base', frames: { start: 0, end: 8 }, frameRate: 6, repeat: -1 },
} as const

/**
 * AnimationSystem
 * Registers Phaser animations once during scene create().
 * Holds no per-frame state after registration.
 */
export class AnimationSystem {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  createPlayerAnimations() {
    this._register(PLAYER_CONFIG.IDLE)
    this._register(PLAYER_CONFIG.WALK)
    this._register(PLAYER_CONFIG.MINE)
    this._register(PLAYER_CONFIG.AXE)
    this._register(PLAYER_CONFIG.DOING)
    this._registerSafe(PLAYER_CONFIG.WAITING)
    this._registerSafe(FISHING_CONFIG.CASTING)
    this._registerSafe(FISHING_CONFIG.REELING)
    this._registerSafe(FISHING_CONFIG.CAUGHT)
  }

  createNpcAnimations() {
    // NPC reuses the player_idle texture — register a separate key so NPCs
    // can be paused/controlled independently.
    const cfg = NPC_CONFIG.IDLE
    if (this.scene.anims.exists(cfg.key)) return
    if (!this.scene.textures.exists(cfg.texture)) return
    this.scene.anims.create({
      key:       cfg.key,
      frames:    this.scene.anims.generateFrameNumbers(cfg.texture, cfg.frames),
      frameRate: cfg.frameRate,
      repeat:    cfg.repeat,
    })
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _register(conf: AnimConf & { texture?: string }) {
    if (this.scene.anims.exists(conf.key)) return
    const tex = (conf as any).texture ?? conf.key
    if (!this.scene.textures.exists(tex)) {
      console.warn(`[AnimationSystem] Skipping "${conf.key}" — texture not loaded`)
      return
    }
    this.scene.anims.create({
      key:       conf.key,
      frames:    this.scene.anims.generateFrameNumbers(tex, conf.frames),
      frameRate: conf.frameRate,
      repeat:    conf.repeat,
    })
  }

  private _registerSafe(conf: AnimConf & { texture?: string }) {
    if (this.scene.anims.exists(conf.key)) return
    try { this._register(conf) } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[AnimationSystem] Could not register "${conf.key}":`, msg)
    }
  }
}

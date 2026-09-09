import type Phaser from 'phaser'
import {
  NPC_ANIMS,
  PLAYER_ANIMS,
  PLAYER_SUPPORT_ANIMS,
  type AnimationDefinition,
} from '@/phaser/config/AnimationConfig'

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
    PLAYER_ANIMS.forEach((config) => this._registerSafe(config))
    PLAYER_SUPPORT_ANIMS.forEach((config) => this._registerSafe(config))
  }

  createNpcAnimations() {
    NPC_ANIMS.forEach((config) => this._registerSafe(config))
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _register(conf: AnimationDefinition) {
    if (this.scene.anims.exists(conf.key)) return
    const tex = conf.texture
    if (!this.scene.textures.exists(tex)) {
      console.warn(`[AnimationSystem] Skipping "${conf.key}" — texture not loaded`)
      return
    }
    this.scene.anims.create({
      key:       conf.key,
      frames:    this.scene.anims.generateFrameNumbers(tex, { start: 0, end: conf.frames - 1 }),
      frameRate: conf.frameRate,
      repeat:    conf.repeat,
    })
  }

  private _registerSafe(conf: AnimationDefinition) {
    if (this.scene.anims.exists(conf.key)) return
    try { this._register(conf) } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[AnimationSystem] Could not register "${conf.key}":`, msg)
    }
  }
}

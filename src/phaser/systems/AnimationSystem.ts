import type Phaser from 'phaser'
import {
  NPC_ANIMS,
  PLAYER_ANIMS,
  PLAYER_SUPPORT_ANIMS,
  type AnimationDefinition,
} from '@/phaser/config/AnimationConfig'
import { DIRECTION_ROW, DEFAULT_FACING, FACINGS, directionalKey } from '@/phaser/systems/DirectionalAnimation'

/**
 * AnimationSystem
 * Registers Phaser animations once during scene create().
 *
 * Sheets with `rows: 4` are sliced per direction (row 0 up, row 1 down,
 * row 2 left, row 3 right) into `<key>_<facing>` animations, plus a `<key>`
 * alias bound to the front-facing row.
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
    const tex = conf.texture
    if (!this.scene.textures.exists(tex)) {
      console.warn(`[AnimationSystem] Skipping "${conf.key}" — texture not loaded`)
      return
    }

    const totalFrames = this.scene.textures.get(tex).frameTotal - 1
    const rows = conf.rows === 4 && totalFrames >= conf.frames * 4 ? 4 : 1

    if (rows === 4) {
      for (const facing of FACINGS) {
        const start = DIRECTION_ROW[facing] * conf.frames
        this._create(directionalKey(conf.key, facing), conf, start)
      }
      // Bare key alias → front-facing row.
      this._create(conf.key, conf, DIRECTION_ROW[DEFAULT_FACING] * conf.frames)
      return
    }

    this._create(conf.key, conf, 0)
  }

  private _create(key: string, conf: AnimationDefinition, start: number) {
    if (this.scene.anims.exists(key)) return
    this.scene.anims.create({
      key,
      frames: this.scene.anims.generateFrameNumbers(conf.texture, {
        start,
        end: start + conf.frames - 1,
      }),
      frameRate: conf.frameRate,
      repeat: conf.repeat,
      skipMissedFrames: conf.skipMissedFrames,
    })
  }

  private _registerSafe(conf: AnimationDefinition) {
    try { this._register(conf) } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[AnimationSystem] Could not register "${conf.key}":`, msg)
    }
  }
}

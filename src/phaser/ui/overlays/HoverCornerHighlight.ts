import type Phaser from 'phaser'
import { GAME_CONFIG } from '@/phaser/config/GameConfig'

interface Bounds {
  left:   number
  top:    number
  right:  number
  bottom: number
}

interface HoverCornerHighlightOptions {
  tileSize?:     number
  depth?:        number
  scale?:        number
  enabled?:      boolean
  resolveBounds?: (ctx: { tileX: number; tileY: number; worldPoint: Phaser.Math.Vector2; pointer: Phaser.Input.Pointer }) => Bounds | null
}

/**
 * HoverCornerHighlight
 * Shows selectbox corner sprites around the tile under the mouse cursor.
 * Only activates for tiles that contain an interactable object within the
 * player's proximity range. Hidden on touch events — mobile uses taps directly.
 *
 * Usage:
 *   new HoverCornerHighlight(scene, {
 *     resolveBounds: ({ tileX, tileY }) => boundsOrNull
 *   })
 */
export class HoverCornerHighlight {
  private scene:          Phaser.Scene
  private tileSize:       number
  private depth:          number
  private scale:          number
  enabled:                boolean
  private resolveBounds:  HoverCornerHighlightOptions['resolveBounds']
  private _lastTileX:     number | null
  private _lastTileY:     number | null
  corners!:               { tl: Phaser.GameObjects.Image; tr: Phaser.GameObjects.Image; bl: Phaser.GameObjects.Image; br: Phaser.GameObjects.Image }
  private _onPointerMove: ((p: Phaser.Input.Pointer) => void) | null = null

  constructor(scene: Phaser.Scene, opts: HoverCornerHighlightOptions = {}) {
    this.scene        = scene
    this.tileSize     = opts.tileSize ?? GAME_CONFIG.TILE_SIZE
    this.depth        = opts.depth   ?? 8
    this.scale        = opts.scale   ?? 0.5
    this.enabled      = opts.enabled ?? true
    this.resolveBounds = typeof opts.resolveBounds === 'function' ? opts.resolveBounds : () => null

    this._lastTileX = null
    this._lastTileY = null

    this._create()
    this._registerListeners()
  }

  setEnabled(enabled: boolean) {
    this.enabled    = !!enabled
    this._lastTileX = null
    this._lastTileY = null
    if (!enabled) this.hide()
  }

  show(left: number, top: number, right: number, bottom: number) {
    const { tl, tr, bl, br } = this.corners
    tl.setVisible(true).setPosition(left,  top)
    tr.setVisible(true).setPosition(right, top)
    bl.setVisible(true).setPosition(left,  bottom)
    br.setVisible(true).setPosition(right, bottom)
  }

  hide() {
    Object.values(this.corners).forEach((c) => c?.setVisible(false))
  }

  destroy() {
    if (this.scene?.input && this._onPointerMove) {
      this.scene.input.off('pointermove', this._onPointerMove)
    }
    Object.values(this.corners).forEach((c) => c?.destroy())
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _create() {
    const mk = (key: string, ox: number, oy: number) =>
      this.scene.add
        .image(0, 0, key)
        .setOrigin(ox, oy)
        .setScale(this.scale)
        .setDepth(this.depth)
        .setVisible(false)

    this.corners = {
      tl: mk('selectbox_tl', 0, 0),
      tr: mk('selectbox_tr', 1, 0),
      bl: mk('selectbox_bl', 0, 1),
      br: mk('selectbox_br', 1, 1),
    }
  }

  private _registerListeners() {
    this._onPointerMove = (pointer) => this._handleMove(pointer)
    this.scene.input.on('pointermove', this._onPointerMove)
  }

  private _handleMove(pointer: Phaser.Input.Pointer) {
    if (!this.enabled || !this.scene?.cameras?.main) { this.hide(); return }

    // Hide on touch — mobile uses taps directly
    const pointerType = (pointer as unknown as { event?: { pointerType?: string } })?.event?.pointerType
      ?? ((pointer as unknown as { wasTouch?: boolean })?.wasTouch ? 'touch' : 'mouse')
    if (pointerType === 'touch') { this.hide(); return }

    const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y)
    const tx = Math.floor(wp.x / this.tileSize)
    const ty = Math.floor(wp.y / this.tileSize)

    // Skip redundant redraws when the tile hasn't changed
    if (tx === this._lastTileX && ty === this._lastTileY) return
    this._lastTileX = tx
    this._lastTileY = ty

    const bounds = this.resolveBounds?.({ tileX: tx, tileY: ty, worldPoint: wp, pointer }) ?? null
    if (!bounds) { this.hide(); return }
    this.show(bounds.left, bounds.top, bounds.right, bounds.bottom)
  }
}

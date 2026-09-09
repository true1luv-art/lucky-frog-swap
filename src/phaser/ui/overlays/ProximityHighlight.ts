import type Phaser from 'phaser'
import { GAME_CONFIG } from '@/phaser/config/GameConfig'

// ProximityHighlight — ported directly from the Phaser 3.87 reference implementation.
//
// Two highlight modes, matching the reference exactly:
//
//   • Non-sprite nodes (trees, stones, plots):
//       Corner bracket sprites (selectbox_tl/tr/bl/br) positioned using
//       node.x / node.y / node.width / node.height (world-pixel tile bounds).
//
//   • Sprite nodes (buildings, animals):
//       preFX.addGlow(0xffffff, 4, 0, false) — a tight white glow outline
//       that follows the sprite's transparent pixels in WebGL.
//       Canvas renderer falls back to a warm tint (0xffffcc).
//
// preFX is available in Phaser 3.60–3.87 WebGL mode. It was removed in Phaser 4.
// By pinning phaser@3.87.0 this implementation works exactly as in the reference.

interface NodeLike {
  x:       number
  y:       number
  width?:  number
  height?: number
  sprite?: Phaser.GameObjects.Image
}

type CornerEntry = {
  tl: Phaser.GameObjects.Image
  tr: Phaser.GameObjects.Image
  bl: Phaser.GameObjects.Image
  br: Phaser.GameObjects.Image
}

type SpriteEntry = {
  _spriteRef: Phaser.GameObjects.Image
}

type Entry = CornerEntry | SpriteEntry

function isSpriteEntry(e: Entry): e is SpriteEntry {
  return '_spriteRef' in e
}

/**
 * ProximityHighlight
 *
 * Shows selectbox corner sprites around any interactable object that falls
 * within the player's proximity range.
 *
 * Each highlighted node gets its own set of four corner sprites (or a glow FX
 * for sprite-based nodes) so multiple objects can be highlighted simultaneously.
 *
 * ProximitySystem calls showNode() / hideNode() as objects enter and leave range.
 */
export class ProximityHighlight {
  private scene:    Phaser.Scene
  private depth:    number
  private scale:    number
  /** nodeKey → corner entry (resource nodes) or sprite entry (building/animal) */
  private _entries: Map<string, Entry>

  constructor(scene: Phaser.Scene, opts: { depth?: number; scale?: number } = {}) {
    this.scene    = scene
    this.depth    = opts.depth ?? 7
    this.scale    = opts.scale ?? 0.5
    this._entries = new Map()
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Show corner highlights (or glow FX) around a node.
   *
   * If the node has a `.sprite` (building or animal), apply a white preFX glow
   * outline instead of corner brackets — matching the reference exactly.
   * Otherwise use corner brackets positioned from node.x/y/width/height.
   *
   * @param key  — unique string identifier (node.id or tile coord string)
   * @param node — { x, y, width?, height?, sprite? }
   */
  showNode(key: string, node: NodeLike) {
    const ts = GAME_CONFIG.TILE_SIZE

    // ── Sprite path (buildings, animals) ──────────────────────────────────
    if (node.sprite) {
      this._applyOutline(node.sprite)
      this._entries.set(key, { _spriteRef: node.sprite })
      return
    }

    // ── Corner bracket path (trees, stones, plots) ─────────────────────────
    const left   = node.x
    const top    = node.y
    const right  = node.x + (node.width  ?? ts)
    const bottom = node.y + (node.height ?? ts)

    if (this._entries.has(key)) {
      const existing = this._entries.get(key)!
      if (!isSpriteEntry(existing)) {
        this._positionCorners(existing, left, top, right, bottom, true)
      }
      return
    }

    const corners = this._createCorners()
    this._positionCorners(corners, left, top, right, bottom, true)
    this._entries.set(key, corners)
  }

  /**
   * Hide the highlight for a node.
   * Removes the glow FX from sprite nodes, hides corners from resource nodes.
   */
  hideNode(key: string) {
    const entry = this._entries.get(key)
    if (!entry) return

    if (isSpriteEntry(entry)) {
      this._removeOutline(entry._spriteRef)
      return
    }

    entry.tl.setVisible(false)
    entry.tr.setVisible(false)
    entry.bl.setVisible(false)
    entry.br.setVisible(false)
  }

  hideAll() {
    for (const [key] of this._entries) this.hideNode(key)
  }

  destroy() {
    for (const entry of this._entries.values()) {
      if (isSpriteEntry(entry)) {
        this._removeOutline(entry._spriteRef)
      } else {
        entry.tl.destroy()
        entry.tr.destroy()
        entry.bl.destroy()
        entry.br.destroy()
      }
    }
    this._entries.clear()
  }

  // ── Outline helpers (sprite nodes only) ───────────────────────────────────

  /**
   * Apply a white preFX glow outline around a building / animal sprite.
   *
   * addGlow(color, outerStrength, innerStrength, knockout)
   *   outerStrength = 4  → matches the CSS drop-shadow(1px) white-edge effect.
   *   knockout      = false → glow on top of the sprite, not through it.
   *
   * preFX respects the sprite's transparent pixels, giving a tight outline
   * around the actual shape rather than its rectangular bounding box.
   * Requires WebGL renderer + Phaser 3.60+. Canvas renderer falls back to tint.
   */
  private _applyOutline(sprite: Phaser.GameObjects.Image) {
    if (!sprite?.active) return
    try {
      // preFX is available in Phaser 3.60–3.87 WebGL
      const preFX = (sprite as Phaser.GameObjects.Image & { preFX?: { addGlow: (color: number, outerStrength: number, innerStrength: number, knockout: boolean) => unknown; remove: (fx: unknown) => void } }).preFX
      const fx = preFX?.addGlow(0xffffff, 4, 0, false)
      ;(sprite as Phaser.GameObjects.Image & { _proximityFX?: unknown })._proximityFX = fx
    } catch {
      // Canvas renderer fallback — warm tint brightens the sprite noticeably
      sprite.setTint(0xffffcc)
      ;(sprite as Phaser.GameObjects.Image & { _proximityTinted?: boolean })._proximityTinted = true
    }
  }

  /**
   * Remove the outline / tint applied by _applyOutline.
   */
  private _removeOutline(sprite: Phaser.GameObjects.Image) {
    if (!sprite?.active) return
    try {
      const s = sprite as Phaser.GameObjects.Image & {
        _proximityFX?: unknown
        _proximityTinted?: boolean
        preFX?: { remove: (fx: unknown) => void }
      }
      if (s._proximityFX) {
        s.preFX?.remove(s._proximityFX)
        s._proximityFX = undefined
      }
      if (s._proximityTinted) {
        sprite.clearTint()
        s._proximityTinted = false
      }
    } catch {
      // ignore — sprite may already be destroyed
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _createCorners(): CornerEntry {
    const mk = (key: string, ox: number, oy: number) =>
      this.scene.add
        .image(0, 0, key)
        .setOrigin(ox, oy)
        .setScale(this.scale)
        .setDepth(this.depth)
        .setVisible(false)

    return {
      tl: mk('selectbox_tl', 0, 0),
      tr: mk('selectbox_tr', 1, 0),
      bl: mk('selectbox_bl', 0, 1),
      br: mk('selectbox_br', 1, 1),
    }
  }

  private _positionCorners(
    corners: CornerEntry,
    left: number, top: number, right: number, bottom: number,
    visible: boolean,
  ) {
    corners.tl.setPosition(left,  top   ).setVisible(visible)
    corners.tr.setPosition(right, top   ).setVisible(visible)
    corners.bl.setPosition(left,  bottom).setVisible(visible)
    corners.br.setPosition(right, bottom).setVisible(visible)
  }
}

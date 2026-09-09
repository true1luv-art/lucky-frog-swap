import type Phaser from 'phaser'
import { GAME_CONFIG } from '@/phaser/config/GameConfig'
import type { Player } from '@/phaser/entities/Player'

interface InteractableNode {
  id?: string
  x: number
  y: number
  width?: number
  height?: number
  isDepleted?: boolean
}

interface ProximityHighlightLike {
  showNode(key: string, node: InteractableNode): void
  hideNode(key: string): void
}

type NodeCollections = Record<string, Record<string, InteractableNode> | undefined>

/**
 * ProximitySystem
 * Computes which interactable objects fall within the player's tile range
 * each frame and notifies listeners so overlays and click-handlers can react.
 *
 * Design:
 *  - Objects in range are highlighted (via ProximityHighlight).
 *  - Player CLICKS the highlighted object to trigger interaction.
 */
export class ProximitySystem {
  private scene:       Phaser.Scene
  private player:      Player
  private radiusTiles: number
  private _inRange:    Set<string>
  private _highlighted: Map<string, InteractableNode>

  constructor(
    scene:  Phaser.Scene,
    player: Player,
    options: { radiusTiles?: number } = {},
  ) {
    this.scene       = scene
    this.player      = player
    this.radiusTiles = options.radiusTiles ?? GAME_CONFIG.INTERACTION_RADIUS_TILES
    this._inRange    = new Set()
    this._highlighted = new Map()
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  update(nodeCollections: NodeCollections, highlight?: ProximityHighlightLike) {
    const ts = GAME_CONFIG.TILE_SIZE
    const px = Math.floor(this.player.sprite.x / ts)
    const py = Math.floor(this.player.sprite.y / ts)
    const r  = this.radiusTiles

    this._inRange.clear()
    for (let tx = px - r; tx <= px + r; tx++) {
      for (let ty = py - r; ty <= py + r; ty++) {
        this._inRange.add(`${tx},${ty}`)
      }
    }

    const nowHighlighted = new Map<string, InteractableNode>()

    for (const nodes of Object.values(nodeCollections)) {
      if (!nodes) continue
      for (const node of Object.values(nodes)) {
        if (!node || node.isDepleted) continue

        const nodeTileX = Math.floor(node.x / ts)
        const nodeTileY = Math.floor(node.y / ts)
        const nodeTileW = Math.ceil((node.width  ?? ts) / ts)
        const nodeTileH = Math.ceil((node.height ?? ts) / ts)

        let overlaps = false
        outer: for (let tx = nodeTileX; tx < nodeTileX + nodeTileW; tx++) {
          for (let ty = nodeTileY; ty < nodeTileY + nodeTileH; ty++) {
            if (this._inRange.has(`${tx},${ty}`)) { overlaps = true; break outer }
          }
        }

        if (overlaps) {
          const key = String(node.id ?? `${nodeTileX},${nodeTileY}`)
          nowHighlighted.set(key, node)
        }
      }
    }

    if (highlight) {
      for (const [key] of this._highlighted) {
        if (!nowHighlighted.has(key)) highlight.hideNode(key)
      }
      for (const [key, node] of nowHighlighted) {
        if (!this._highlighted.has(key)) highlight.showNode(key, node)
      }
    }

    this._highlighted = nowHighlighted
  }

  isNodeInRange(node: InteractableNode): boolean {
    if (!node) return false
    const ts        = GAME_CONFIG.TILE_SIZE
    const nodeTileX = Math.floor(node.x / ts)
    const nodeTileY = Math.floor(node.y / ts)
    const nodeTileW = Math.ceil((node.width  ?? ts) / ts)
    const nodeTileH = Math.ceil((node.height ?? ts) / ts)

    for (let tx = nodeTileX; tx < nodeTileX + nodeTileW; tx++) {
      for (let ty = nodeTileY; ty < nodeTileY + nodeTileH; ty++) {
        if (this._inRange.has(`${tx},${ty}`)) return true
      }
    }
    return false
  }

  destroy() {
    this._inRange.clear()
    this._highlighted.clear()
  }
}

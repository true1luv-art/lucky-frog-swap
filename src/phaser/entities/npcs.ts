import type Phaser from 'phaser'
import { NPC_CONFIG } from '@/phaser/config/GameConfig'
import type { NpcPositionDef } from '@/phaser/positions/npcPositions'
import type { NpcNode } from '@/phaser/farm/types'

export function npcIdleAnimationKey(texture: string): string {
  return texture === NPC_CONFIG.textureKey ? NPC_CONFIG.animKey : `${texture}_idle`
}

interface NpcSpriteOptions {
  x: number
  y: number
  width: number
  height: number
  texture?: string
  facing?: 'left' | 'right'
  origin?: number
  depth?: number
}

/** Creates an animated NPC sprite for either the game world or map editor. */
export function createNpcSprite(
  scene: Phaser.Scene,
  options: NpcSpriteOptions,
): Phaser.GameObjects.Sprite {
  const requestedTexture = options.texture ?? NPC_CONFIG.textureKey
  const texture = scene.textures.exists(requestedTexture)
    ? requestedTexture
    : NPC_CONFIG.textureKey
  const origin = options.origin ?? 0.5
  const sprite = scene.add
    .sprite(options.x, options.y, texture, 0)
    .setOrigin(origin, origin)
    .setDisplaySize(options.width, options.height)
    .setFlipX(options.facing === 'left')

  if (options.depth !== undefined) sprite.setDepth(options.depth)

  const animationKey = npcIdleAnimationKey(texture)
  if (scene.anims.exists(animationKey)) sprite.play(animationKey, true)
  return sprite
}

/** World NPC entity with the same sprite lifecycle pattern as Player. */
export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly node: NpcNode

  constructor(scene: Phaser.Scene, definition: NpcPositionDef, tileSize: number) {
    const x = definition.x * tileSize
    const y = definition.y * tileSize
    const width = definition.width * tileSize
    const height = definition.height * tileSize
    const texture = definition.texture ?? NPC_CONFIG.textureKey

    this.sprite = createNpcSprite(scene, {
      x: x + width / 2,
      y: y + height / 2,
      width,
      height,
      texture,
      facing: definition.facing,
      depth: y + height,
    })

    this.node = {
      id: definition.id,
      texture,
      event: definition.event ?? '',
      name: definition.name,
      x,
      y,
      width,
      height,
      sprite: this.sprite,
    }
  }

  destroy(): void {
    this.sprite.destroy()
  }
}

export function createNpc(
  scene: Phaser.Scene,
  definition: NpcPositionDef,
  tileSize: number,
): Npc {
  return new Npc(scene, definition, tileSize)
}
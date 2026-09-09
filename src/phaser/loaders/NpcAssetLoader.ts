import type Phaser from 'phaser'
import rancherAsset from '@/assets/npcs/rancher_strip9.png.asset.json'
import traderAsset from '@/assets/npcs/trader_strip9.png.asset.json'

const PLAYER_SPRITES = 'assets/phaser/sprites'

/** Loads every NPC spritesheet used by the game and map editor. */
export const NpcAssetLoader = {
  load(scene: Phaser.Scene): void {
    scene.load.spritesheet('npc_base', `${PLAYER_SPRITES}/frog_idle_strip9.png`, {
      frameWidth: 96,
      frameHeight: 64,
    })
    scene.load.spritesheet('npc_rancher', rancherAsset.url, {
      frameWidth: 96,
      frameHeight: 64,
    })
    scene.load.spritesheet('npc_trader', traderAsset.url, {
      frameWidth: 96,
      frameHeight: 64,
    })
    scene.load.spritesheet('npc_blacksmith', 'assets/npcs/blacksmith.png', {
      frameWidth: 84,
      frameHeight: 56,
    })
  },
}
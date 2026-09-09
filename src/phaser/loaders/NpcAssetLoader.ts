import type Phaser from 'phaser'

const PLAYER_SPRITES = 'assets/phaser/sprites'
const NPC_SPRITES = 'assets/npcs'

/** Loads every NPC spritesheet used by the game and map editor. */
export const NpcAssetLoader = {
  load(scene: Phaser.Scene): void {
    scene.load.spritesheet('npc_base', `${PLAYER_SPRITES}/frog_idle_strip9.png`, {
      frameWidth: 96,
      frameHeight: 64,
    })
    scene.load.spritesheet('npc_rancher', `${NPC_SPRITES}/rancher_strip9.png`, {
      frameWidth: 96,
      frameHeight: 64,
    })
    scene.load.spritesheet('npc_trader', `${NPC_SPRITES}/trader_strip9.png`, {
      frameWidth: 96,
      frameHeight: 64,
    })
    scene.load.spritesheet('npc_blacksmith', `${NPC_SPRITES}/blacksmith_strip23.png`, {
      // The filename is misleading: the source is 1920px wide and contains
      // 24 native 80x56 frames. Slicing it as 23 frames makes every frame drift.
      frameWidth: 80,
      frameHeight: 56,
    })
  },
}

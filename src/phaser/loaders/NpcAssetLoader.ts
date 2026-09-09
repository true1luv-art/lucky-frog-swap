import type Phaser from 'phaser'

const CHAR_SPRITES = 'assets/phaser/sprites/characters'
const NPC_SPRITES = 'assets/phaser/sprites/npcs'

/** All NPC art uses the same 80×80 character pack as the player. */
const FW = 80
const FH = 80

/** Loads every NPC spritesheet used by the game and map editor. */
export const NpcAssetLoader = {
  load(scene: Phaser.Scene): void {
    scene.load.spritesheet('npc_base', `${CHAR_SPRITES}/idle_strip6.png`, {
      frameWidth: FW,
      frameHeight: FH,
    })
    scene.load.spritesheet('npc_rancher', `${NPC_SPRITES}/rancher_strip6.png`, {
      frameWidth: FW,
      frameHeight: FH,
    })
    scene.load.spritesheet('npc_trader', `${NPC_SPRITES}/trader_strip6.png`, {
      frameWidth: FW,
      frameHeight: FH,
    })
    scene.load.spritesheet('npc_blacksmith', `${NPC_SPRITES}/blacksmith_strip20.png`, {
      frameWidth: FW,
      frameHeight: FH,
    })
  },
}

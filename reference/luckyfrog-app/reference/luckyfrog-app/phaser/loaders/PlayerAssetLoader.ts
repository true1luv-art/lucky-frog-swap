import type Phaser from 'phaser'

const SPR = 'assets/phaser/sprites'
const FW  = 96
const FH  = 64

export const PlayerAssetLoader = {
  load(scene: Phaser.Scene) {
    // ── Player: frog sprites ──────────────────────────────────────────────
    scene.load.spritesheet('player_idle',    `${SPR}/frog_idle_strip9.png`,    { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_walk',    `${SPR}/frog_walk_strip8.png`,    { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_mine',    `${SPR}/frog_mining_strip10.png`, { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_axe',     `${SPR}/frog_axe_strip10.png`,    { frameWidth: FW, frameHeight: FH })
    // The frog "doing" strip is 8 frames of 94px (752px total), not 96px.
    scene.load.spritesheet('player_doing',   `${SPR}/frog_doing_strip8.png`,   { frameWidth: 94, frameHeight: FH })
    scene.load.spritesheet('player_casting', `${SPR}/frog_casting_strip15.png`,{ frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_caught',  `${SPR}/frog_caught_strip10.png`, { frameWidth: FW, frameHeight: FH })

    // ── NPCs: also frogs, using the frog idle sheet ───────────────────────
    scene.load.spritesheet('npc_base',       `${SPR}/frog_idle_strip9.png`,    { frameWidth: FW, frameHeight: FH })
  },
}

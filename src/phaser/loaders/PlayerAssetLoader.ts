import type Phaser from 'phaser'

const SPR = 'assets/phaser/sprites/characters'
const FW  = 96
const FH  = 64

// New character pack sheets: 80x80 frames, 4 rows per sheet.
const NW = 80
const NH = 80

export const PlayerAssetLoader = {
  load(scene: Phaser.Scene) {
    // ── Player: frog sprites ──────────────────────────────────────────────
    scene.load.spritesheet('player_idle',    `${SPR}/frog_idle_strip9.png`,    { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_walk',    `${SPR}/frog_walk_strip8.png`,    { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_mine',    `${SPR}/frog_mining_strip10.png`, { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_axe',     `${SPR}/frog_axe_strip10.png`,    { frameWidth: FW, frameHeight: FH })
    // frog_doing uses 94px frames (8 × 94 = 752px strip)
    scene.load.spritesheet('player_doing',   `${SPR}/frog_doing_strip8.png`,   { frameWidth: 94, frameHeight: FH })
    scene.load.spritesheet('player_casting', `${SPR}/frog_casting_strip15.png`,{ frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_caught',  `${SPR}/frog_caught_strip10.png`, { frameWidth: FW, frameHeight: FH })

    // ── New character pack (80×80, 4 rows) ────────────────────────────────
    scene.load.spritesheet('char_axe',              `${SPR}/axe_strip10.png`,              { frameWidth: NW, frameHeight: NH })
    scene.load.spritesheet('char_damage',           `${SPR}/damage_strip8.png`,            { frameWidth: NW, frameHeight: NH })
    scene.load.spritesheet('char_death',            `${SPR}/death_strip14.png`,            { frameWidth: NW, frameHeight: NH })
    scene.load.spritesheet('char_fishing_casting',  `${SPR}/fishing_casting_strip15.png`,  { frameWidth: NW, frameHeight: NH })
    scene.load.spritesheet('char_fishing_catching', `${SPR}/fishing_catching_strip10.png`, { frameWidth: NW, frameHeight: NH })
    scene.load.spritesheet('char_fishing_idle',     `${SPR}/fishing_idle_strip10.png`,     { frameWidth: NW, frameHeight: NH })
    scene.load.spritesheet('char_fishing_reeling',  `${SPR}/fishing_reeling_strip10.png`,  { frameWidth: NW, frameHeight: NH })
  },
}

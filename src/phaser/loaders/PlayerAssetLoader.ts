import type Phaser from 'phaser'

const SPR = 'assets/phaser/sprites/characters'

/** New character pack: 80×80 frames, 4 rows (row 0 is used for animations). */
const FW = 80
const FH = 80

export const PlayerAssetLoader = {
  load(scene: Phaser.Scene) {
    // ── Player: 80×80 character pack ──────────────────────────────────────
    scene.load.spritesheet('player_idle',    `${SPR}/idle_strip6.png`,              { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_walk',    `${SPR}/walk_strip6.png`,              { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_mine',    `${SPR}/pickaxe_strip10.png`,          { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_axe',     `${SPR}/axe_strip10.png`,              { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_doing',   `${SPR}/hoe_strip18.png`,              { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_shovel',  `${SPR}/shovel_strip13.png`,           { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_hammer',  `${SPR}/hammer_strip20.png`,           { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_casting', `${SPR}/fishing_casting_strip15.png`,  { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_caught',  `${SPR}/fishing_catching_strip10.png`, { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_fishidle',`${SPR}/fishing_idle_strip10.png`,     { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_reel',    `${SPR}/fishing_reeling_strip10.png`,  { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_damage',  `${SPR}/damage_strip8.png`,            { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_death',   `${SPR}/death_strip14.png`,            { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_bow',     `${SPR}/bow_strip6.png`,               { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_sword',   `${SPR}/sword_strip9.png`,             { frameWidth: FW, frameHeight: FH })
    scene.load.spritesheet('player_watering',`${SPR}/watering_strip5.png`,          { frameWidth: FW, frameHeight: FH })
  },
}

import type Phaser from 'phaser'

export const FarmAssetLoader = {
  load(scene: Phaser.Scene) {
    this._loadTilemap(scene)
    this._loadResourceNodes(scene)
    this._loadUICorners(scene)
    this._loadAudio(scene)
  },

  _loadTilemap(scene: Phaser.Scene) {
    scene.load.image('tiles', 'assets/phaser/tiles/spr_tileset_sunnysideworld_16px.png')
    scene.load.tilemapTiledJSON('island', 'assets/phaser/maps/island.json')
  },

  _loadResourceNodes(scene: Phaser.Scene) {
    scene.load.image('stone_rock',  'assets/resources/stone_node.png')
    scene.load.image('iron_rock',   'assets/resources/iron_node.png')
    scene.load.image('gold_rock',   'assets/resources/gold_node.png')

    scene.load.image('stone_empty', 'assets/resources/stone/stone_empty.png')
    scene.load.image('iron_empty',  'assets/resources/iron/iron_empty.png')
    scene.load.image('gold_empty',  'assets/resources/gold/gold_empty.png')
    scene.load.image('tree_empty',  'assets/resources/tree/tree_empty.png')

    scene.load.image('progress_quarter', 'assets/ui/progress/quarter.png')
    scene.load.image('progress_almost',  'assets/ui/progress/almost.png')

    scene.load.spritesheet('drop_stone', 'assets/resources/stone/stone_drop.png', { frameWidth: 91, frameHeight: 66 })
    scene.load.spritesheet('drop_iron',  'assets/resources/iron/iron_drop.png',   { frameWidth: 91, frameHeight: 66 })
    scene.load.spritesheet('drop_gold',  'assets/resources/gold/gold_drop.png',   { frameWidth: 91, frameHeight: 66 })
    scene.load.spritesheet('drop_tree',  'assets/resources/tree/tree_drop.png',   { frameWidth: 91, frameHeight: 66 })

    scene.load.image('tree_node', 'assets/resources/tree_node.png')
    scene.load.image('plot_soil', 'assets/land/soil2.png')
    scene.load.image('plot_lock', 'assets/skills/lock.png')

    const CROP_NAMES = [
      'potato', 'pumpkin', 'carrot', 'cabbage', 'beetroot',
      'cauliflower', 'parsnip', 'radish', 'wheat', 'kale', 'sunflower',
    ]
    for (const name of CROP_NAMES) {
      const readyFile = name === 'sunflower' ? 'planted.png' : 'plant.png'
      scene.load.image(`crop_${name}_seedling`, `assets/crops/${name}/seedling.png`)
      scene.load.image(`crop_${name}_almost`,   `assets/crops/${name}/almost.png`)
      scene.load.image(`crop_${name}_ready`,    `assets/crops/${name}/${readyFile}`)
    }

    scene.load.image('building_house',        'assets/buildings/house.png')
    scene.load.image('building_market',       'assets/buildings/market_building.png')
    scene.load.image('building_blacksmith',   'assets/buildings/blacksmith_building.png')
    scene.load.image('building_kitchen',      'assets/buildings/kitchen_building.png')
    scene.load.image('building_bank',         'assets/buildings/tailor.gif')
    scene.load.image('building_wishing_well', 'assets/buildings/wishing_well.png')

    scene.load.spritesheet('animal_chicken', 'assets/phaser/sprites/animals/spr_deco_chicken_01_strip4.png', { frameWidth: 32, frameHeight: 32 })
    scene.load.spritesheet('animal_sheep',   'assets/phaser/sprites/animals/spr_deco_sheep_01_strip4.png',   { frameWidth: 32, frameHeight: 32 })
    scene.load.spritesheet('animal_cow',     'assets/phaser/sprites/animals/spr_deco_cow_strip4.png',        { frameWidth: 32, frameHeight: 32 })

    scene.load.image('icon_player',  'assets/icons/player.png')
    scene.load.image('icon_plant',   'assets/icons/plant.png')
    scene.load.image('icon_hammer',  'assets/icons/hammer.png')
    scene.load.image('icon_token',   'assets/icons/token.png')
    scene.load.image('icon_lock',    'assets/skills/lock.png')
    scene.load.image('icon_town',    'assets/icons/town.png')

    scene.load.image('expr_stress',  'assets/icons/expression_stress.png')
    scene.load.image('expr_happy',   'assets/icons/expression_happy.png')
    scene.load.image('expr_alerted', 'assets/icons/expression_alerted.png')

    scene.load.image('feed_wheat',   'assets/crops/wheat/crop.png')
    scene.load.image('feed_kale',    'assets/crops/kale/crop.png')
    scene.load.image('feed_cabbage', 'assets/crops/cabbage/crop.png')
  },

  _loadUICorners(scene: Phaser.Scene) {
    scene.load.image('selectbox_tl', 'assets/ui/select/selectbox_tl.png')
    scene.load.image('selectbox_tr', 'assets/ui/select/selectbox_tr.png')
    scene.load.image('selectbox_bl', 'assets/ui/select/selectbox_bl.png')
    scene.load.image('selectbox_br', 'assets/ui/select/selectbox_br.png')
  },

  _loadAudio(scene: Phaser.Scene) {
    scene.load.audio('sfx_chop',        'assets/sound-effects/chop.mp3')
    scene.load.audio('sfx_tree_fall',   'assets/sound-effects/tree_fall.mp3')
    scene.load.audio('sfx_mining',      'assets/sound-effects/mining.mp3')
    scene.load.audio('sfx_mining_fall', 'assets/sound-effects/mining_fall.mp3')
    scene.load.audio('sfx_harvest',     'assets/sound-effects/harvest.mp3')
    scene.load.audio('sfx_plant',       'assets/sound-effects/plant.mp3')
    scene.load.audio('sfx_barn',        'assets/sound-effects/barn.mp3')
    scene.load.audio('sfx_blacksmith',  'assets/sound-effects/blacksmith.mp3')
    scene.load.audio('sfx_kitchen',     'assets/sound-effects/kitchen.mp3')
    scene.load.audio('sfx_bank',        'assets/sound-effects/bank.mp3')
    scene.load.audio('sfx_shop',        'assets/sound-effects/shop.mp3')
    scene.load.audio('sfx_home_door',   'assets/sound-effects/home_door.mp3')
    scene.load.audio('sfx_frog',        'assets/sound-effects/frog.mp3')
  },
}

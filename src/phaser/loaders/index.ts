import type Phaser from 'phaser'
import { FarmAssetLoader }     from '@/phaser/loaders/FarmAssetLoader'
import { PlayerAssetLoader }   from '@/phaser/loaders/PlayerAssetLoader'
import { BuildingAssetLoader } from '@/phaser/loaders/BuildingAssetLoader'
import { NpcAssetLoader }      from '@/phaser/loaders/NpcAssetLoader'

export { FarmAssetLoader }
export { PlayerAssetLoader }
export { BuildingAssetLoader }
export { NpcAssetLoader }

export function loadFarmAssets(scene: Phaser.Scene)     { FarmAssetLoader.load(scene) }
export function loadPlayerAssets(scene: Phaser.Scene)   { PlayerAssetLoader.load(scene) }
export function loadBuildingAssets(scene: Phaser.Scene) { BuildingAssetLoader.load(scene) }
export function loadNpcAssets(scene: Phaser.Scene)      { NpcAssetLoader.load(scene) }

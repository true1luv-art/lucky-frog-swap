import type Phaser from 'phaser'

/**
 * BuildingAssetLoader
 * Loads Lucky Frog building sprites from public/assets/buildings/.
 * Called only during preload().
 *
 * Texture keys must match what BuildingZone looks up:
 *   building_summoning_shrine, building_cabin
 *
 * Hall of Fame is menu-only and no longer needs a map texture.
 */
export const BuildingAssetLoader = {
  load(scene: Phaser.Scene) {
    scene.load.image('building_summoning_shrine', 'assets/buildings/hatchery.png')
    scene.load.image('building_cabin',            'assets/buildings/cabin.png')
  },
}

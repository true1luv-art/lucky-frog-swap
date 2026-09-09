import type Phaser from "phaser";

/**
 * MapAssetLoader
 * Loads the Tiled tilemap JSON and the sunnyside tileset image.
 * Called only during scene preload().
 *
 * Map: public/assets/phaser/maps/farm.json
 *   40×40 tiles, 16 px per tile → 640×640 px world.
 *   Tileset internal name: "spr_tileset_sunnysideworld_16px"
 *   Layers (bottom → top): grass, path_1, path_2, trees, decor_1
 */
export const MapAssetLoader = {
  load(scene: Phaser.Scene) {
    scene.load.image(
      "tiles",
      "assets/phaser/tiles/spr_tileset_sunnysideworld_16px.png",
    );
    scene.load.tilemapTiledJSON("farm", "assets/phaser/maps/farm.json");
  },
};

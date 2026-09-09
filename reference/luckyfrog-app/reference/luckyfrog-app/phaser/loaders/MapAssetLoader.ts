import type Phaser from "phaser";

/**
 * MapAssetLoader
 * Loads the Tiled tilemap JSON and the sunnyside tileset image.
 * Called only during scene preload().
 *
 * Map: public/assets/phaser/maps/island.json
 *   50×50 tiles, 16 px per tile → 800×800 px world.
 *   Tileset internal name: "spr_tileset_sunnysideworld_16px"
 */
export const MapAssetLoader = {
  load(scene: Phaser.Scene) {
    scene.load.image(
      "tiles",
      "assets/phaser/tiles/spr_tileset_sunnysideworld_16px.png",
    );
    scene.load.tilemapTiledJSON("island", "assets/phaser/maps/island.json");
  },
};

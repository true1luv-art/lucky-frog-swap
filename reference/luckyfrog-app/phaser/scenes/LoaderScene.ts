import Phaser from "phaser";
import { MapAssetLoader }      from "@/phaser/loaders/MapAssetLoader";
import { PlayerAssetLoader }   from "@/phaser/loaders/PlayerAssetLoader";
import { FarmAssetLoader }     from "@/phaser/loaders/FarmAssetLoader";
import { BuildingAssetLoader } from "@/phaser/loaders/BuildingAssetLoader";

/**
 * LoaderScene
 *
 * Preloads ALL phaserv1 assets — tilemap, player sprites, farm resources,
 * and building images — then starts FarmScene.
 * Shows a progress bar during loading.
 */
export class LoaderScene extends Phaser.Scene {


  constructor() {
    super("LoaderScene");
  }

  preload() {
    // Core map + player
    MapAssetLoader.load(this);
    PlayerAssetLoader.load(this);

    // Full farm asset suite (tiles, resource nodes, crops, animals, UI corners,
    // audio) — mirrors hearthvale FarmAssetLoader exactly
    FarmAssetLoader.load(this);

    // Farm building sprites
    BuildingAssetLoader.load(this);

    // Forward real asset-load progress to the React loading overlay.
    this.load.on("progress", (value: number) => {
      window.dispatchEvent?.(
        new CustomEvent("phaser-load-progress", { detail: { value } }),
      );
    });

    this.load.on("complete", () => {
      window.dispatchEvent?.(
        new CustomEvent("phaser-load-progress", { detail: { value: 1 } }),
      );
    });

    // Gracefully skip missing optional assets (e.g. SFX not yet in /public)
    this.load.on(
      "loaderror",
      (file: Phaser.Loader.File) => {
        console.warn(`[LoaderScene] Asset not found, skipping: ${file.key} (${file.url})`);
      },
    );
  }

  create() {
    window.dispatchEvent?.(
      new CustomEvent("phaser-scene-start", {
        detail: { sceneName: "LoaderScene" },
      }),
    );

    // Brief delay so the canvas settles before switching scenes
    this.time.delayedCall(200, () => {
      if (this.sys?.settings?.status > 0) {
        this.scene.start("FarmScene");
      }
    });

  }
}

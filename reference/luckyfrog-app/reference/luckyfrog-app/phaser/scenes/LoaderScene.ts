import Phaser from "phaser";
import { MapAssetLoader }      from "@/phaser/loaders/MapAssetLoader";
import { PlayerAssetLoader }   from "@/phaser/loaders/PlayerAssetLoader";
import { FarmAssetLoader }     from "@/phaser/loaders/FarmAssetLoader";
import { BuildingAssetLoader } from "@/phaser/loaders/BuildingAssetLoader";

/**
 * LoaderScene
 *
 * Preloads ALL phaserv1 assets — tilemap, player sprites, farm resources,
 * and the five Lucky Frog building images — then starts FarmScene.
 * Shows a progress bar during loading.
 */
export class LoaderScene extends Phaser.Scene {
  private _bar?:  Phaser.GameObjects.Rectangle;
  private _text?: Phaser.GameObjects.Text;

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

    // Lucky Frog building sprites
    BuildingAssetLoader.load(this);

    this._createProgressBar();

    this.load.on("progress", (value: number) => {
      if (this._bar) this._bar.width = value * 200;
      // Forward real asset-load progress to the React loading overlay.
      window.dispatchEvent?.(
        new CustomEvent("phaser-load-progress", { detail: { value } }),
      );
    });

    this.load.on("complete", () => {
      if (this._text) this._text.setText("Starting…");
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._bar?.destroy();
      this._text?.destroy();
    });
  }

  private _createProgressBar() {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this._text = this.add
      .text(cx, cy - 30, "Loading…", {
        fontSize:  "20px",
        color:     "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Track background
    this.add.rectangle(cx, cy, 204, 20, 0x333333).setOrigin(0.5);

    // Progress bar — grows from left edge
    this._bar = this.add
      .rectangle(cx - 100, cy, 0, 16, 0x44bb66)
      .setOrigin(0, 0.5);
  }
}

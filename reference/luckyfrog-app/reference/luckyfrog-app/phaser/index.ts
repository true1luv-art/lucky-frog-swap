import Phaser from "phaser";
import { LoaderScene } from "@/phaser/scenes/LoaderScene";
import { FarmScene }   from "@/phaser/scenes/FarmScene";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";

/**
 * startPhaserGame
 *
 * Instantiates the Phaser.Game for the /phaser route.
 * Called by PhaserCanvas.tsx via a dynamic import so it only runs
 * client-side — never on the server.
 *
 * Scenes are registered in postBoot so the registry is fully initialised.
 */
export default function startPhaserGame(
  parent: string | HTMLElement,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: GAME_CONFIG.BG_COLOR,
    pixelArt: GAME_CONFIG.PIXEL_ART,
    render: {
      antialias:    false,
      roundPixels:  true,
    },
    physics: {
      default: "arcade",
      arcade: {
        debug:   false,
        gravity: { x: 0, y: GAME_CONFIG.GRAVITY.y },
      },
    },
    scale: {
      mode:       Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width:      "100%",
      height:     "100%",
    },
    scene: [],
    callbacks: {
      postBoot(game: Phaser.Game) {
        game.scene.add("LoaderScene", LoaderScene, true);
        game.scene.add("FarmScene",   FarmScene,   false);
      },
    },
  });
}

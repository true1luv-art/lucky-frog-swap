import type Phaser from "phaser";
import { GAME_CONFIG, PLAYER_CONFIG } from "@/phaser/config/GameConfig";

/**
 * Movement vector produced by InputSystem each frame.
 */
export interface MovementResult {
  vx:      number;
  vy:      number;
  moving:  boolean;
  facing:  "left" | "right" | "up" | "down";
  flipX:   boolean;
}

/**
 * Player — data container only.
 * Movement logic lives in InputSystem; animation logic lives in AnimationSystem.
 */
export class Player {
  sprite: Phaser.Physics.Arcade.Sprite;
  speed:  number;
  facing: "left" | "right" | "up" | "down";

  constructor(
    sprite: Phaser.Physics.Arcade.Sprite,
    config: { speed?: number } = {},
  ) {
    this.sprite = sprite;
    this.speed  = config.speed ?? GAME_CONFIG.PLAYER_SPEED;
    this.facing = "down";
  }

  applyMovement(movement: MovementResult) {
    if (!this.sprite.body) return;
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(
      movement.vx,
      movement.vy,
    );
    // Only call setFlipX when the value changes to prevent per-frame flicker
    // on pure up/down movement.
    if (
      typeof movement.flipX === "boolean" &&
      this.sprite.flipX !== movement.flipX
    ) {
      this.sprite.setFlipX(movement.flipX);
    }
    this.facing = movement.facing;
  }

  destroy() {
    this.sprite?.destroy();
  }
}

/**
 * Factory: creates a Player and its physics sprite.
 */
export function createPlayer(
  scene: Phaser.Scene,
  spawn: { x: number; y: number },
  config: { speed?: number } = {},
): Player {
  const px = isFinite(spawn?.x) ? spawn.x : 400;
  const py = isFinite(spawn?.y) ? spawn.y : 400;

  const textureKey = scene.textures.exists("player_idle")
    ? "player_idle"
    : "__DEFAULT";

  const sprite = scene.physics.add.sprite(px, py, textureKey);
  (sprite.body as Phaser.Physics.Arcade.Body)
    .setSize(PLAYER_CONFIG.BODY_SIZE.width, PLAYER_CONFIG.BODY_SIZE.height)
    .setOffset(PLAYER_CONFIG.BODY_OFFSET.x, PLAYER_CONFIG.BODY_OFFSET.y);

  if (textureKey === "player_idle" && scene.anims.exists("player_idle")) {
    sprite.play("player_idle");
  } else if (textureKey === "__DEFAULT") {
    sprite.setDisplaySize(16, 24).setTint(0x44bb66);
  }

  return new Player(sprite, config);
}

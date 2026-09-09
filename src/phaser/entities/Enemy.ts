import type Phaser from "phaser";
import { GAME_CONFIG, PLAYER_CONFIG } from "@/phaser/config/GameConfig";
import { ENEMY_CONFIG, type EnemyConfig, type EnemyType } from "@/features/game/enemies";
import { DEFAULT_FACING, playDirectional, type Facing } from "@/phaser/systems/DirectionalAnimation";

export type EnemyState = "idle" | "wander" | "chase" | "attack" | "return";

/**
 * Enemy — reuses the player sprite sheets with a tint.
 * Pure data container plus tiny sprite helpers; the AI lives in EnemySystem.
 */
export class Enemy {
  id: string;
  type: EnemyType;
  config: EnemyConfig;
  sprite: Phaser.Physics.Arcade.Sprite;
  hpBar: Phaser.GameObjects.Graphics;

  hp: number;
  maxHp: number;
  state: EnemyState = "idle";
  spawnX: number;
  spawnY: number;
  targetX = 0;
  targetY = 0;
  lastAttackAt = 0;
  nextWanderAt = 0;
  /** Epoch ms when the telegraphed swing lands; 0 when not winding up. */
  windupUntil = 0;
  /** Epoch ms until which this enemy chases the player after being hit. */
  provokedUntil = 0;
  dying = false;
  /** Direction row used for the sprite animations. */
  facing: Facing = DEFAULT_FACING;


  constructor(scene: Phaser.Scene, id: string, type: EnemyType, x: number, y: number) {
    this.id = id;
    this.type = type;
    this.config = ENEMY_CONFIG[type];
    this.spawnX = x;
    this.spawnY = y;
    this.hp = this.config.hp;
    this.maxHp = this.config.hp;

    const textureKey = scene.textures.exists("player_idle") ? "player_idle" : "__DEFAULT";
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setTint(this.config.spriteTint);
    this.sprite.setDepth(y);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;
    body
      ?.setSize(PLAYER_CONFIG.BODY_SIZE.width, PLAYER_CONFIG.BODY_SIZE.height)
      .setOffset(PLAYER_CONFIG.BODY_OFFSET.x, PLAYER_CONFIG.BODY_OFFSET.y);
    body?.setCollideWorldBounds(true);

    if (textureKey === "player_idle") {
      playDirectional(this.sprite, "player_idle", this.facing);
    } else if (textureKey === "__DEFAULT") {
      this.sprite.setDisplaySize(14, 20);
    }

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(y + 1);
    this.drawHpBar();
  }

  /** Feet position — the physics body centre, used for all distance maths. */
  get bodyX(): number {
    return this.sprite.x + PLAYER_CONFIG.BODY_OFFSET.x + PLAYER_CONFIG.BODY_SIZE.width / 2
      - GAME_CONFIG.SPRITE_WIDTH / 2;
  }

  get bodyY(): number {
    return this.sprite.y + PLAYER_CONFIG.BODY_OFFSET.y + PLAYER_CONFIG.BODY_SIZE.height / 2
      - GAME_CONFIG.SPRITE_HEIGHT / 2;
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
    this.drawHpBar();
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  drawHpBar() {
    const w = 18;
    const h = 3;
    const x = this.bodyX - w / 2;
    const y = this.bodyY - 22;
    const pct = this.maxHp > 0 ? this.hp / this.maxHp : 0;

    this.hpBar.clear();
    if (this.dying || this.hp <= 0) return;
    this.hpBar.setDepth(this.sprite.y + 1);
    this.hpBar.fillStyle(0x201a1a, 0.85);
    this.hpBar.fillRect(x - 1, y - 1, w + 2, h + 2);
    this.hpBar.fillStyle(pct > 0.5 ? 0x6fd36f : pct > 0.25 ? 0xe8c05a : 0xe05a5a, 1);
    this.hpBar.fillRect(x, y, Math.max(0, w * pct), h);
  }

  destroy() {
    this.hpBar?.destroy();
    this.sprite?.destroy();
  }
}

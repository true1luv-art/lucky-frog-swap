import Phaser from "phaser";
import { GAME_CONFIG, PLAYER_CONFIG } from "@/phaser/config/GameConfig";
import { Enemy } from "@/phaser/entities/Enemy";
import {
  ENEMY_LEASH_TILES,
  ENEMY_ATTACK_EXIT_FACTOR,
  ENEMY_SEPARATION_PX,
} from "@/features/game/enemies";
import { ENEMY_SPAWN_POINTS, type EnemySpawnPoint } from "@/phaser/positions/enemySpawnPoints";


const TS = GAME_CONFIG.TILE_SIZE;

interface EnemySystemOptions {
  /** Called when an enemy lands a hit; the scene decides about invulnerability. */
  onPlayerHit: (damage: number) => void;
  /** Called once per enemy death, after the reward should be granted. */
  onEnemyKilled: (enemy: Enemy) => void;
}

/**
 * EnemySystem — spawning, respawning, and the per-enemy AI state machine:
 *   idle → wander → chase → attack → return
 */
export class EnemySystem {
  enemyGroup: Phaser.Physics.Arcade.Group;
  private scene: Phaser.Scene;
  private opts: EnemySystemOptions;
  private enemies: Enemy[] = [];
  /** spawn point id → epoch ms when it may spawn again */
  private respawnAt = new Map<string, number>();

  constructor(scene: Phaser.Scene, opts: EnemySystemOptions) {
    this.scene = scene;
    this.opts = opts;
    this.enemyGroup = scene.physics.add.group();
  }

  create() {
    for (const point of ENEMY_SPAWN_POINTS) this.spawn(point);
  }

  private spawn(point: EnemySpawnPoint) {
    const x = point.x * TS + TS / 2;
    const y = point.y * TS + TS / 2;
    const enemy = new Enemy(this.scene, point.id, point.type, x, y);
    this.enemyGroup.add(enemy.sprite);
    (enemy.sprite as unknown as Record<string, unknown>).__enemyId = point.id;
    this.enemies.push(enemy);
  }

  findBySprite(sprite: unknown): Enemy | undefined {
    return this.enemies.find((e) => e.sprite === sprite && !e.dying);
  }

  getEnemies(): Enemy[] {
    return this.enemies;
  }

  /** Send every living enemy home — used on player death. */
  resetAll() {
    for (const enemy of this.enemies) {
      if (enemy.dying) continue;
      enemy.sprite.setPosition(enemy.spawnX, enemy.spawnY);
      (enemy.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
      enemy.hp = enemy.maxHp;
      enemy.state = "idle";
      enemy.drawHpBar();
    }
  }

  handleDeath(enemy: Enemy) {
    if (enemy.dying) return;
    enemy.dying = true;
    enemy.hpBar.clear();
    (enemy.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
    this.opts.onEnemyKilled(enemy);

    this.scene.tweens.add({
      targets: enemy.sprite,
      alpha: 0,
      duration: 280,
      onComplete: () => {
        const spawnId = enemy.id;
        const point = ENEMY_SPAWN_POINTS.find((p) => p.id === spawnId);
        this.enemies = this.enemies.filter((e) => e !== enemy);
        this.enemyGroup.remove(enemy.sprite, false, false);
        enemy.destroy();
        if (point) {
          const cfg = point;
          this.respawnAt.set(
            cfg.id,
            Date.now() + (enemy.config.respawnSeconds ?? 15) * 1000,
          );
        }
      },
    });
  }

  update(playerSprite: Phaser.Physics.Arcade.Sprite) {
    const now = Date.now();

    // Respawn due spawn points
    for (const [id, at] of [...this.respawnAt.entries()]) {
      if (now < at) continue;
      const point = ENEMY_SPAWN_POINTS.find((p) => p.id === id);
      this.respawnAt.delete(id);
      if (point) this.spawn(point);
    }

    const px = playerSprite.x + PLAYER_CONFIG.BODY_OFFSET.x + PLAYER_CONFIG.BODY_SIZE.width / 2
      - GAME_CONFIG.SPRITE_WIDTH / 2;
    const py = playerSprite.y + PLAYER_CONFIG.BODY_OFFSET.y + PLAYER_CONFIG.BODY_SIZE.height / 2
      - GAME_CONFIG.SPRITE_HEIGHT / 2;

    for (const enemy of this.enemies) {
      if (enemy.dying) continue;
      const cfg = enemy.config;
      const ex = enemy.bodyX;
      const ey = enemy.bodyY;
      const distPlayer = Phaser.Math.Distance.Between(ex, ey, px, py);
      const distSpawn = Phaser.Math.Distance.Between(
        enemy.sprite.x, enemy.sprite.y, enemy.spawnX, enemy.spawnY,
      );

      // ── Decide state ───────────────────────────────────────────────────
      if (distSpawn > ENEMY_LEASH_TILES * TS) {
        enemy.state = "return";
      } else if (distPlayer <= cfg.attackRangeTiles * TS) {
        enemy.state = "attack";
      } else if (distPlayer <= cfg.aggroRangeTiles * TS) {
        enemy.state = "chase";
      } else if (enemy.state === "chase" || enemy.state === "attack") {
        enemy.state = "return";
      }

      // ── Act ────────────────────────────────────────────────────────────
      switch (enemy.state) {
        case "idle": {
          this.stop(enemy);
          if (now >= enemy.nextWanderAt) {
            const angle = Math.random() * Math.PI * 2;
            const radius = TS * (1 + Math.random() * 3);
            enemy.targetX = enemy.spawnX + Math.cos(angle) * radius;
            enemy.targetY = enemy.spawnY + Math.sin(angle) * radius;
            enemy.state = "wander";
          }
          break;
        }
        case "wander": {
          const reached = this.moveTo(enemy, enemy.targetX, enemy.targetY, cfg.speed * 0.5);
          if (reached) {
            enemy.state = "idle";
            enemy.nextWanderAt = now + 1000 + Math.random() * 2000;
          }
          break;
        }
        case "chase": {
          this.moveTo(enemy, px + (enemy.sprite.x - ex), py + (enemy.sprite.y - ey), cfg.speed);
          break;
        }
        case "return": {
          const home = this.moveTo(enemy, enemy.spawnX, enemy.spawnY, cfg.speed * 0.8);
          if (home) {
            enemy.state = "idle";
            enemy.nextWanderAt = now + 800;
          }
          break;
        }
        case "attack": {
          this.stop(enemy);
          enemy.sprite.setFlipX(px < ex);
          if (now - enemy.lastAttackAt >= cfg.attackCooldownMs) {
            enemy.lastAttackAt = now;
            this.playOnce(enemy, "player_axe");
            this.opts.onPlayerHit(cfg.damage);
          }
          break;
        }
      }

      enemy.sprite.setDepth(enemy.sprite.y);
      enemy.drawHpBar();
    }
  }

  // ── Movement helpers ─────────────────────────────────────────────────────

  private moveTo(enemy: Enemy, targetX: number, targetY: number, speed: number): boolean {
    const dx = targetX - enemy.sprite.x;
    const dy = targetY - enemy.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) { this.stop(enemy); return true; }

    const body = enemy.sprite.body as Phaser.Physics.Arcade.Body | null;
    body?.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    if (Math.abs(dx) > 1) enemy.sprite.setFlipX(dx < 0);
    this.playLoop(enemy, "player_walk");
    return false;
  }

  private stop(enemy: Enemy) {
    (enemy.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
    this.playLoop(enemy, "player_idle");
  }

  private playLoop(enemy: Enemy, key: string) {
    const current = enemy.sprite.anims?.currentAnim?.key;
    if (current === "player_axe" && enemy.sprite.anims?.isPlaying) return;
    if (current === key) return;
    if (this.scene.anims.exists(key)) enemy.sprite.play(key, true);
  }

  private playOnce(enemy: Enemy, key: string) {
    if (this.scene.anims.exists(key)) enemy.sprite.play(key, true);
  }

  destroy() {
    for (const enemy of this.enemies) enemy.destroy();
    this.enemies = [];
    this.respawnAt.clear();
    this.enemyGroup?.clear(true, true);
  }
}

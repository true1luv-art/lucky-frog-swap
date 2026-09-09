import Phaser from "phaser";
import { GAME_CONFIG, PLAYER_CONFIG } from "@/phaser/config/GameConfig";
import { Enemy } from "@/phaser/entities/Enemy";
import { ENEMY_SEPARATION_PX } from "@/features/game/enemies";
import {
  canStartAttack,
  decideEnemyState,
  nextWanderDelay,
  pickWanderTarget,
  shouldAttackConnect,
} from "@/phaser/ai/EnemyBehavior";
import {
  findPath,
  hasLineOfSight,
  nextWaypoint,
  toTile,
  type TilePoint,
} from "@/phaser/ai/Pathfinding";
import { ENEMY_SPAWN_POINTS, type EnemySpawnPoint } from "@/phaser/positions/enemySpawnPoints";
import {
  animBase,
  facingFromVector,
  playDirectional,
  type Facing,
} from "@/phaser/systems/DirectionalAnimation";


const TS = GAME_CONFIG.TILE_SIZE;

interface EnemySystemOptions {
  /** Called when an enemy lands a hit; the scene decides about invulnerability. */
  onPlayerHit: (damage: number) => void;
  /** Called once per enemy death, after the reward should be granted. */
  onEnemyKilled: (enemy: Enemy) => void;
  /**
   * Optional walkability test used by the A* chase pathing.
   * When omitted, enemies chase in a straight line as before.
   */
  isTileBlocked?: (tileX: number, tileY: number) => boolean;
}

interface ChasePath {
  tiles: TilePoint[];
  repathAt: number;
}

/** How often a chasing enemy is allowed to recompute its route. */
const REPATH_INTERVAL_MS = 500;

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
  /** enemy id → cached A* route while chasing */
  private paths = new Map<string, ChasePath>();
  /** enemy id → last known position, for stuck detection */
  private progress = new Map<string, { x: number; y: number; at: number }>();
  /** enemy id → temporary sidestep target while unsticking */
  private detours = new Map<string, { x: number; y: number; until: number }>();

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
      enemy.windupUntil = 0;
      enemy.provokedUntil = 0;
      enemy.drawHpBar();
    }
    this.paths.clear();
    this.progress.clear();
    this.detours.clear();
  }

  handleDeath(enemy: Enemy) {
    if (enemy.dying) return;
    this.paths.delete(enemy.id);
    this.progress.delete(enemy.id);
    this.detours.delete(enemy.id);
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

      // ── Decide state (see phaser/ai/EnemyBehavior) ─────────────────────
      const winding = enemy.windupUntil > 0;
      const decision = decideEnemyState({
        config: cfg, state: enemy.state, distPlayer, distSpawn, winding,
        provoked: now < enemy.provokedUntil,
      });
      enemy.state = decision.state;
      if (decision.cancelWindup) enemy.windupUntil = 0;

      // ── Act ────────────────────────────────────────────────────────────
      switch (enemy.state) {
        case "idle": {
          this.stop(enemy);
          if (now >= enemy.nextWanderAt) {
            const spot = pickWanderTarget(enemy.spawnX, enemy.spawnY);
            enemy.targetX = spot.x;
            enemy.targetY = spot.y;
            enemy.state = "wander";
          }
          break;
        }
        case "wander": {
          const reached = this.moveTo(enemy, enemy.targetX, enemy.targetY, cfg.speed * 0.5);
          if (reached) {
            enemy.state = "idle";
            enemy.nextWanderAt = now + nextWanderDelay();
          }
          break;
        }
        case "chase": {
          const offX = enemy.sprite.x - ex;
          const offY = enemy.sprite.y - ey;
          const step = this.chaseStep(enemy, ex, ey, px, py, now);
          this.moveTo(enemy, step.x + offX, step.y + offY, cfg.speed);
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
          if (!winding) enemy.facing = facingFromVector(px - ex, py - ey);

          if (winding) {
            // Resolve the telegraphed swing: it only connects if the player is
            // still inside reach when the blow actually lands.
            if (now >= enemy.windupUntil) {
              enemy.windupUntil = 0;
              if (shouldAttackConnect(cfg, distPlayer)) {
                this.opts.onPlayerHit(cfg.damage);
              }
            }
          } else if (canStartAttack(cfg, distPlayer, enemy.lastAttackAt, now)) {
            enemy.lastAttackAt = now;
            enemy.windupUntil = now + cfg.attackWindupMs;
            this.playOnce(enemy, "player_sword");
          }
          break;
        }
      }

      enemy.sprite.setDepth(enemy.sprite.y);
      enemy.drawHpBar();
    }

    this.separate();
  }

  /**
   * Keeps enemies from stacking into a single sprite when several chase the
   * player, so each one stays individually readable and hittable.
   */
  /**
   * Where a chasing enemy should head this frame: straight at the player when
   * it has a clear line, otherwise the next waypoint of an A* route around
   * whatever is in the way.
   */
  private chaseStep(
    enemy: Enemy, ex: number, ey: number, px: number, py: number, now: number,
  ): { x: number; y: number } {
    const stuck = this.trackStuck(enemy, ex, ey, now);
    const isBlocked = this.opts.isTileBlocked;
    if (!isBlocked) return { x: px, y: py };

    // Sliding along a wall for a moment: commit to a sidestep so the enemy
    // never grinds against the same corner forever.
    const detour = this.detours.get(enemy.id);
    if (detour && now < detour.until) return { x: detour.x, y: detour.y };

    const from = toTile(ex, ey);
    const to = toTile(px, py);
    if (!stuck && hasLineOfSight(from, to, isBlocked)) {
      this.paths.delete(enemy.id);
      return { x: px, y: py };
    }

    let path = this.paths.get(enemy.id);
    if (stuck || !path || now >= path.repathAt || path.tiles.length === 0) {
      path = { tiles: findPath(from, to, { isBlocked }), repathAt: now + REPATH_INTERVAL_MS };
      this.paths.set(enemy.id, path);
    }

    const waypoint = nextWaypoint(path.tiles, ex, ey, 6);
    if (waypoint) return waypoint;

    if (stuck) {
      // No route at all — slide perpendicular to the player direction.
      const dx = px - ex;
      const dy = py - ey;
      const len = Math.hypot(dx, dy) || 1;
      const side = Math.random() < 0.5 ? 1 : -1;
      const spot = {
        x: ex + (-dy / len) * TS * 2 * side,
        y: ey + (dx / len) * TS * 2 * side,
        until: now + 700,
      };
      this.detours.set(enemy.id, spot);
      return { x: spot.x, y: spot.y };
    }

    return { x: px, y: py };
  }

  /**
   * True when the enemy has barely moved while trying to chase — the signal
   * that its current route is useless and needs to be thrown away.
   */
  private trackStuck(enemy: Enemy, ex: number, ey: number, now: number): boolean {
    const prev = this.progress.get(enemy.id);
    if (!prev) {
      this.progress.set(enemy.id, { x: ex, y: ey, at: now });
      return false;
    }
    if (Math.hypot(ex - prev.x, ey - prev.y) > 3) {
      this.progress.set(enemy.id, { x: ex, y: ey, at: now });
      return false;
    }
    if (now - prev.at < 350) return false;
    this.progress.set(enemy.id, { x: ex, y: ey, at: now });
    this.paths.delete(enemy.id);
    return true;
  }

  private separate() {
    const living = this.enemies.filter((e) => !e.dying);
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i];
        const b = living[j];
        const dx = b.bodyX - a.bodyX;
        const dy = b.bodyY - a.bodyY;
        const dist = Math.hypot(dx, dy);
        if (dist === 0 || dist >= ENEMY_SEPARATION_PX) continue;
        const push = (ENEMY_SEPARATION_PX - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.sprite.setPosition(a.sprite.x - nx * push, a.sprite.y - ny * push);
        b.sprite.setPosition(b.sprite.x + nx * push, b.sprite.y + ny * push);
      }
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
    enemy.facing = facingFromVector(dx, dy);
    this.playLoop(enemy, "player_walk");
    return false;
  }

  private stop(enemy: Enemy) {
    (enemy.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
    this.playLoop(enemy, "player_idle");
  }

  private playLoop(enemy: Enemy, key: string) {
    const current = enemy.sprite.anims?.currentAnim?.key;
    if (animBase(current) === "player_sword" && enemy.sprite.anims?.isPlaying) return;
    const facing = (enemy.facing ?? "down") as Facing;
    if (current === `${key}_${facing}` || current === key) return;
    playDirectional(enemy.sprite, key, facing);
  }

  private playOnce(enemy: Enemy, key: string) {
    playDirectional(enemy.sprite, key, (enemy.facing ?? "down") as Facing, false);
  }

  destroy() {
    for (const enemy of this.enemies) enemy.destroy();
    this.enemies = [];
    this.respawnAt.clear();
    this.paths.clear();
    this.progress.clear();
    this.detours.clear();
    this.enemyGroup?.clear(true, true);
  }
}

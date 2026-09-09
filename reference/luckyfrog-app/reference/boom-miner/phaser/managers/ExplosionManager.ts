import * as Phaser from "phaser";
import { TILE_SIZE, TileType, isDestructible } from "@/features/types/TileTypes";
import { GAME_CONFIG } from "../config/GameConfig";
import { STATIC_ANIMS } from "../config/AnimationConfig";
import type { MapManager } from "./MapManager";
import type { Pathfinding } from "../systems/Pathfinding";

interface ActiveExplosion {
  tiles: { x: number; y: number }[];
  sprites: Phaser.GameObjects.Sprite[];
  endAt: number;
}

const BOOM_ANIM_KEY = STATIC_ANIMS[0].key;

export class ExplosionManager {
  private scene: Phaser.Scene;
  private map: MapManager;
  private pathfinding: Pathfinding;
  private spritePool: Phaser.GameObjects.Sprite[] = [];
  private active: ActiveExplosion[] = [];

  constructor(scene: Phaser.Scene, map: MapManager, pathfinding: Pathfinding) {
    this.scene = scene;
    this.map = map;
    this.pathfinding = pathfinding;
  }

  /**
   * Detonate at (bx,by) with `range` and `damage`.
   * `heroId` is the Zustand hero id of the bomb owner — passed to MapManager
   * so the action route knows which hero consumed energy.
   * Returns tiles destroyed with coin drops.
   */
  detonate(
    bx: number,
    by: number,
    range: number,
    damage = 1,
    heroId = "",
  ): { destroyed: { x: number; y: number; coins: number }[]; hitKeys: string[] } {
    const tiles: { x: number; y: number }[] = [{ x: bx, y: by }];
    const visualTiles: { x: number; y: number }[] = [{ x: bx, y: by }];
    const destroyed: { x: number; y: number; coins: number }[] = [];
    // Every destructible node the blast touched (damaged OR destroyed).
    // The server must apply the same `power` damage to these keys, so it
    // stays in lockstep with the optimistic client and never "resurrects" them.
    const hitKeys: string[] = [];

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      for (let step = 1; step <= range; step++) {
        const x = bx + dx * step;
        const y = by + dy * step;
        const t = this.map.grid[y]?.[x];
        if (t === undefined || t === TileType.Wall) break;
        tiles.push({ x, y });
        if (isDestructible(t as TileType)) {
          hitKeys.push(`${x},${y}`);
          const res = this.map.damageTile(x, y, damage, heroId);
          if (res.destroyed) {
            this.pathfinding.updateTile(x, y, TileType.Grass);
            destroyed.push({ x, y, coins: res.coins });
          }
          // Do not overlay boom on destructible tiles that were hit.
          break;
        }
        visualTiles.push({ x, y });
      }
    }

    // draw animated boom sprite only on non-destructible tiles
    const sprites: Phaser.GameObjects.Sprite[] = [];
    for (const tile of visualTiles) {
      const px = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const py = tile.y * TILE_SIZE + TILE_SIZE / 2;
      const spr =
        this.spritePool.pop() ?? this.scene.add.sprite(px, py, "boom", 0);
      spr.setPosition(px, py);
      spr.setDepth(GAME_CONFIG.EXPLOSION.DEPTH);
      spr.setDisplaySize(TILE_SIZE, TILE_SIZE);
      spr.setVisible(true);
      spr.setActive(true);
      spr.play(BOOM_ANIM_KEY);
      sprites.push(spr);
    }
    this.active.push({
      tiles,
      sprites,
      endAt: this.scene.time.now + GAME_CONFIG.EXPLOSION.DURATION_MS,
    });

    // SFX + juice
    const ex = GAME_CONFIG.EXPLOSION;
    if (this.scene.cache.audio.exists("boom_sfx")) {
      this.scene.sound.play("boom_sfx", {
        volume: ex.SFX_VOLUME,
        detune: Phaser.Math.Between(-ex.SFX_DETUNE, ex.SFX_DETUNE),
      });
    }
    const shakeIntensity =
      Math.min(ex.SHAKE_MAX, ex.SHAKE_BASE + range * ex.SHAKE_PER_RANGE) * ex.SHAKE_SCALE;
    this.scene.cameras.main.shake(ex.SHAKE_DURATION_MS, shakeIntensity);
    return { destroyed, hitKeys };
  }

  update(now: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      if (now >= e.endAt) {
        for (const s of e.sprites) {
          s.stop();
          s.setVisible(false);
          this.spritePool.push(s);
        }
        this.active.splice(i, 1);
      }
    }
  }

  /** Tiles currently on fire (used to keep AI cautious). */
  getDangerTiles(): Set<string> {
    const s = new Set<string>();
    for (const e of this.active) for (const t of e.tiles) s.add(`${t.x},${t.y}`);
    return s;
  }
}

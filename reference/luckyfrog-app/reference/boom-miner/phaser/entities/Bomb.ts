import * as Phaser from "phaser";
import { TILE_SIZE } from "@/features/types/TileTypes";
import { GAME_CONFIG } from "../config/GameConfig";

export class Bomb {
  tileX: number;
  tileY: number;
  range: number;
  damage: number;
  ownerId: string;
  detonateAt: number;
  active = true;
  private fuseMs: number;



  private gfx: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    range: number,
    ownerId: string,
    fuseMs: number,
    damage: number,
  ) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;
    this.range = range;
    this.damage = damage;
    this.ownerId = ownerId;
    this.fuseMs = fuseMs;
    this.detonateAt = scene.time.now + fuseMs;
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(GAME_CONFIG.BOMB.DEPTH);
    this.draw(0);
  }

  update(now: number): void {
    if (!this.active) return;
    const remain = Math.max(0, this.detonateAt - now);
    const t = 1 - remain / this.fuseMs;
    this.draw(t);
  }


  private draw(t: number): void {
    const px = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = this.tileY * TILE_SIZE + TILE_SIZE / 2;
    const pulse = 1 + Math.sin(t * Math.PI * 8) * 0.08;
    const r = (TILE_SIZE / 2 - 6) * pulse;
    this.gfx.clear();
    this.gfx.fillStyle(0x000000, 1);
    this.gfx.fillCircle(px, py, r);
    this.gfx.fillStyle(0xff5a1f, 1);
    this.gfx.fillCircle(px + 4, py - r + 2, 2);
  }

  deactivate(): void {
    this.active = false;
    this.gfx.clear();
  }


  destroy(): void {
    this.gfx.destroy();
  }
}

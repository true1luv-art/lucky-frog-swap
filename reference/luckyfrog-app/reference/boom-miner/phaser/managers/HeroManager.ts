import * as Phaser from "phaser";
import { Hero, type HeroConfig } from "../entities/Hero";
import { TILE_SIZE } from "@/features/types/TileTypes";

export class HeroManager {
  private scene: Phaser.Scene;
  readonly heroes: Hero[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawn(cfg: HeroConfig): Hero {
    const h = new Hero(this.scene, cfg);
    this.heroes.push(h);
    return h;
  }

  remove(hero: Hero): void {
    const i = this.heroes.indexOf(hero);
    if (i >= 0) this.heroes.splice(i, 1);
    hero.destroy();
  }

  /** Advance hero along its current path. Returns true when it reaches path end. */
  stepAlongPath(hero: Hero, deltaSec: number): boolean {
    if (!hero.path || hero.pathIndex >= hero.path.length) {
      hero.setMoving(false);
      return true;
    }
    const node = hero.path[hero.pathIndex];
    const targetX = node.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = node.y * TILE_SIZE + TILE_SIZE / 2;
    const dx = targetX - hero.x;
    const dy = targetY - hero.y;
    const dist = Math.hypot(dx, dy);
    const step = hero.speed * TILE_SIZE * deltaSec;
    hero.setFacingFromDelta(dx, dy);
    hero.setMoving(true);
    if (dist <= step) {
      hero.x = targetX;
      hero.y = targetY;
      hero.tileX = node.x;
      hero.tileY = node.y;
      hero.pathIndex++;
    } else {
      hero.x += (dx / dist) * step;
      hero.y += (dy / dist) * step;
    }
    hero.draw();
    const done = hero.pathIndex >= hero.path.length;
    if (done) hero.setMoving(false);
    return done;
  }
}

import * as Phaser from "phaser";
import { Loot } from "../entities/Loot";

export class LootManager {
  private scene: Phaser.Scene;
  private pool: Loot[] = [];
  private active: Loot[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawn(tileX: number, tileY: number, value = 1): Loot {
    let loot = this.pool.pop();
    if (!loot) {
      loot = new Loot(this.scene, tileX, tileY, value);
    } else {
      loot.tileX = tileX;
      loot.tileY = tileY;
      loot.value = value;
      loot.active = true;
      // rebuild draw by recreating
      loot.destroy();
      loot = new Loot(this.scene, tileX, tileY, value);
    }
    this.active.push(loot);
    return loot;
  }

  findAt(tileX: number, tileY: number): Loot | undefined {
    return this.active.find((l) => l.active && l.tileX === tileX && l.tileY === tileY);
  }

  findNearest(tileX: number, tileY: number): Loot | undefined {
    let best: Loot | undefined;
    let bestDist = Infinity;
    for (const l of this.active) {
      if (!l.active) continue;
      const d = Math.abs(l.tileX - tileX) + Math.abs(l.tileY - tileY);
      if (d < bestDist) {
        bestDist = d;
        best = l;
      }
    }
    return best;
  }

  collect(loot: Loot): void {
    loot.deactivate();
    const idx = this.active.indexOf(loot);
    if (idx >= 0) this.active.splice(idx, 1);
    this.pool.push(loot);
  }

  getLoot(): readonly Loot[] {
    return this.active;
  }
}

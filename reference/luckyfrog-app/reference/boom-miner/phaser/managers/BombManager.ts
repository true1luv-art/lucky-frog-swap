import * as Phaser from "phaser";
import { Bomb } from "../entities/Bomb";

export class BombManager {
  private scene: Phaser.Scene;
  private pool: Bomb[] = [];
  private active: Bomb[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawn(
    tileX: number,
    tileY: number,
    range: number,
    ownerId: string,
    fuseMs = 2000,
    damage = 1,
  ): Bomb {
    let bomb = this.pool.pop();
    if (!bomb) {
      bomb = new Bomb(this.scene, tileX, tileY, range, ownerId, fuseMs, damage);
    } else {
      bomb.tileX = tileX;
      bomb.tileY = tileY;
      bomb.range = range;
      bomb.damage = damage;
      bomb.ownerId = ownerId;
      bomb.detonateAt = this.scene.time.now + fuseMs;
      bomb.active = true;
    }
    this.active.push(bomb);
    return bomb;
  }

  update(now: number, onDetonate: (bomb: Bomb) => void): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.update(now);
      if (b.active && now >= b.detonateAt) {
        onDetonate(b);
        b.deactivate();
        this.active.splice(i, 1);
        this.pool.push(b);
      }
    }
  }

  getBombs(): readonly Bomb[] {
    return this.active;
  }

  countByOwner(ownerId: string): number {
    let n = 0;
    for (const b of this.active) if (b.ownerId === ownerId) n++;
    return n;
  }
}

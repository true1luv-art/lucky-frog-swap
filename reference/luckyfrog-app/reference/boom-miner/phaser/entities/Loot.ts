import * as Phaser from "phaser";
import { TILE_SIZE } from "@/features/types/TileTypes";

export class Loot {
  tileX: number;
  tileY: number;
  value: number;
  active = true;
  private gfx: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, tileX: number, tileY: number, value = 1) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.value = value;
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(6);
    this.label = scene.add.text(0, 0, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "10px",
      color: "#111",
      fontStyle: "bold",
    });
    this.label.setDepth(7);
    this.draw();
  }

  private draw(): void {
    const px = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = this.tileY * TILE_SIZE + TILE_SIZE / 2;
    this.gfx.clear();
    const r = TILE_SIZE / 2 - 8 + Math.min(6, this.value / 3);
    this.gfx.fillStyle(0xb8860b, 1);
    this.gfx.fillCircle(px, py, r);
    this.gfx.fillStyle(0xffd54a, 1);
    this.gfx.fillCircle(px, py, r - 3);
    if (this.value > 1) {
      this.label.setText(String(this.value));
      this.label.setPosition(px - this.label.width / 2, py - this.label.height / 2);
      this.label.setVisible(true);
    } else {
      this.label.setVisible(false);
    }
  }

  deactivate(): void {
    this.active = false;
    this.gfx.clear();
    this.label.setVisible(false);
  }

  destroy(): void {
    this.gfx.destroy();
    this.label.destroy();
  }
}

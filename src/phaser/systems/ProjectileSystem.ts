import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { BowStats } from "@/features/game/bow";

const ARROW_TEXTURE = "vfx_arrow";
const ARROW_FALLBACK_TEXTURE = "combat_arrow";
/** The sprite art points up, so rotate by +90° relative to travel angle. */
const ARROW_ART_OFFSET = Math.PI / 2;
const ARROW_SPEED = 320; // px/s

export interface Arrow {
  sprite: Phaser.Physics.Arcade.Sprite;
  startX: number;
  startY: number;
  maxDist: number;
  damage: number;
}

/**
 * ProjectileSystem — Archero-style arrows.
 * Arrows fly in a straight line along the player's facing direction and die
 * once they exceed the bow's max range or hit something.
 */
export class ProjectileSystem {
  group: Phaser.Physics.Arcade.Group;
  arrows: Arrow[] = [];
  private scene: Phaser.Scene;

  private texture: string;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._ensureTexture();
    this.texture = scene.textures.exists(ARROW_TEXTURE) ? ARROW_TEXTURE : ARROW_FALLBACK_TEXTURE;
    this.group = scene.physics.add.group({ defaultKey: this.texture, allowGravity: false });
  }

  /** Fallback: draws a tiny pixel arrow when the sprite sheet is missing. */
  private _ensureTexture() {
    if (this.scene.textures.exists(ARROW_TEXTURE)) return;
    if (this.scene.textures.exists(ARROW_FALLBACK_TEXTURE)) return;
    const g = this.scene.add.graphics();
    g.fillStyle(0x6b4423, 1);
    g.fillRect(0, 3, 9, 2);      // shaft
    g.fillStyle(0xd8d8d8, 1);
    g.fillTriangle(9, 1, 9, 7, 13, 4); // head
    g.fillStyle(0xf2e6c9, 1);
    g.fillRect(0, 1, 2, 2);      // fletching
    g.fillRect(0, 5, 2, 2);
    g.generateTexture(ARROW_FALLBACK_TEXTURE, 13, 8);
    g.destroy();
  }

  /**
   * Fire an arrow. When `angleRad` is supplied the arrow flies along that exact
   * angle (mouse aiming); otherwise it uses the four-way facing direction.
   */
  fire(
    x: number,
    y: number,
    facing: "up" | "down" | "left" | "right",
    stats: BowStats,
    angleRad?: number,
  ) {
    const sprite = this.group.get(x, y, this.texture) as Phaser.Physics.Arcade.Sprite | null;
    if (!sprite) return;

    sprite.setActive(true).setVisible(true);
    sprite.setDepth(y + 2);
    sprite.setOrigin(0.5, 0.5);

    const dir =
      angleRad === undefined
        ? {
            up:    { x: 0,  y: -1 },
            down:  { x: 0,  y: 1  },
            left:  { x: -1, y: 0  },
            right: { x: 1,  y: 0  },
          }[facing]
        : { x: Math.cos(angleRad), y: Math.sin(angleRad) };

    const usesSheet = this.texture === ARROW_TEXTURE;
    const body = sprite.body as Phaser.Physics.Arcade.Body | null;
    body?.setAllowGravity(false);
    body?.setSize(10, 10);
    if (usesSheet) body?.setOffset((48 - 10) / 2, (48 - 10) / 2);
    sprite.setVelocity(dir.x * ARROW_SPEED, dir.y * ARROW_SPEED);
    sprite.setRotation(Math.atan2(dir.y, dir.x) + (usesSheet ? ARROW_ART_OFFSET : 0));
    if (usesSheet) sprite.setFrame(0);

    this.arrows.push({
      sprite,
      startX: x,
      startY: y,
      maxDist: stats.rangeTiles * GAME_CONFIG.TILE_SIZE,
      damage: stats.damage,
    });
  }

  findBySprite(sprite: unknown): Arrow | undefined {
    return this.arrows.find((a) => a.sprite === sprite);
  }

  kill(arrow: Arrow) {
    arrow.sprite.setActive(false).setVisible(false);
    arrow.sprite.setVelocity(0, 0);
    this.arrows = this.arrows.filter((a) => a !== arrow);
  }

  update() {
    for (const arrow of [...this.arrows]) {
      const traveled = Phaser.Math.Distance.Between(
        arrow.startX, arrow.startY, arrow.sprite.x, arrow.sprite.y,
      );
      if (!arrow.sprite.active || traveled >= arrow.maxDist) {
        this.kill(arrow);
      }
    }
  }

  destroy() {
    this.arrows = [];
    this.group?.clear(true, true);
  }
}

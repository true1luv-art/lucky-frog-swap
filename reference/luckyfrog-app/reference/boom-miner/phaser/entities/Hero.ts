import * as Phaser from "phaser";
import { HeroState } from "@/features/types/HeroState";
import { TILE_SIZE } from "@/features/types/TileTypes";
import {
  HERO_FACING_ROW,
  HERO_RARITY_DEFS,
  HERO_SPRITES,
  HERO_SPRITE_COLS,
  HeroFacing,
  HeroRarity,
  HeroType,
  pickHeroRarity,
  pickHeroType,
  rollHeroAttributes,
} from "@/features/types/HeroRarity";
import { GAME_CONFIG } from "../config/GameConfig";
import type { PathNode } from "../systems/Pathfinding";

export interface HeroConfig {
  id: string;
  tileX: number;
  tileY: number;
  rarity?: HeroRarity;
  type?: HeroType;
  preset?: {
    power: number;
    speed: number;
    stamina: number;
    bombNum: number;
    bombRange: number;
    energy: number;
  };
}

export class Hero {
  readonly id: string;
  readonly rarity: HeroRarity;
  readonly type: HeroType;
  tileX: number;
  tileY: number;

  power: number;
  speedStat: number;
  stamina: number;
  bombNum: number;
  bombRange: number;
  energy: number;

  speed: number;

  state: HeroState;

  path: PathNode[] | null = null;
  pathIndex = 0;
  x: number;
  y: number;
  waitUntil = 0;
  targetBreakable: PathNode | null = null;
  /** True while walking to a random wander tile (no breakable target yet). */
  roaming = false;

  facing: HeroFacing = "down";
  moving = false;

  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private spriteKey: string;

  constructor(scene: Phaser.Scene, cfg: HeroConfig) {
    this.scene = scene;
    this.id = cfg.id;
    this.tileX = cfg.tileX;
    this.tileY = cfg.tileY;
    this.rarity = cfg.rarity ?? pickHeroRarity(Math.random);
    this.type = cfg.type ?? pickHeroType();

    const attrs = cfg.preset ?? rollHeroAttributes(this.rarity);
    this.power = attrs.power;
    this.speedStat = attrs.speed;
    this.stamina = attrs.stamina;
    this.bombNum = attrs.bombNum;
    this.bombRange = attrs.bombRange;
    this.energy = attrs.energy;
    this.speed = GAME_CONFIG.HERO.SPEED_BASE + attrs.speed * GAME_CONFIG.HERO.SPEED_PER_STAT;

    this.state = HeroState.Searching;
    this.x = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    this.y = this.tileY * TILE_SIZE + TILE_SIZE / 2;

    this.spriteKey = `hero_${HERO_SPRITES[this.type]}`;
    // Walk-cycle anims are registered up-front by the AnimationSystem in
    // BootScene, so there's no per-hero animation setup here.

    const hero = GAME_CONFIG.HERO;
    this.sprite = scene.add.sprite(this.x, this.y + hero.Y_OFFSET, this.spriteKey, 0);
    this.sprite.setScale(hero.SPRITE_SCALE);
    this.sprite.setDepth(hero.DEPTH);

    // 1px rarity outline glow around the sprite.
    const fx = this.sprite.preFX;
    if (fx) {
      fx.setPadding(hero.GLOW.padding);
      fx.addGlow(
        this.rarityTint,
        hero.GLOW.outerStrength,
        hero.GLOW.innerStrength,
        hero.GLOW.knockout,
        hero.GLOW.quality,
        hero.GLOW.distance,
      );
    }

    this.draw();
  }

  get rarityTint(): number {
    return HERO_RARITY_DEFS[this.rarity].tint;
  }

  get rarityLabel(): string {
    return HERO_RARITY_DEFS[this.rarity].label;
  }

  setFacingFromDelta(dx: number, dy: number): void {
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? "right" : "left";
    } else {
      this.facing = dy > 0 ? "down" : "up";
    }
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
    const animKey = `${this.spriteKey}_${this.facing}`;
    if (moving) {
      const current = this.sprite.anims.currentAnim;
      if (!current || current.key !== animKey || !this.sprite.anims.isPlaying) {
        this.sprite.anims.play(animKey, true);
      }
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(HERO_FACING_ROW[this.facing] * HERO_SPRITE_COLS);
    }
  }

  draw(): void {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y + GAME_CONFIG.HERO.Y_OFFSET));
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

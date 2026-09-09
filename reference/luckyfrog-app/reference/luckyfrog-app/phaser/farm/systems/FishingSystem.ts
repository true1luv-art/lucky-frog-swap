import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { Player } from "@/phaser/entities/Player";
import type { FishingNode } from "@/phaser/farm/types";
import { dispatchUiEvent } from "@/phaser/farm/helpers";

interface FishingSystemOptions {
  nodes: Record<string, FishingNode>;
  waterLayer: Phaser.Tilemaps.TilemapLayer | null;
  player: () => Player | undefined;
}

/** Owns fishing-zone discovery, proximity events, cooldowns, and cast animations. */
export class FishingSystem {
  private nearZone = false;
  private casting = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: FishingSystemOptions,
  ) {}

  create(): void {
    const water = this.options.waterLayer;
    if (!water) return;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const isWater = (x: number, y: number) => {
      if (x < 0 || x >= water.layer.width || y < 0 || y >= water.layer.height) return false;
      const tile = water.getTileAt(x, y);
      return Boolean(tile && tile.index > 0);
    };
    const tiles = new Set<string>();
    const cardinals: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < water.layer.height; y += 1) {
      for (let x = 0; x < water.layer.width; x += 1) {
        if (isWater(x, y) && cardinals.some(([dx, dy]) => !isWater(x + dx, y + dy))) {
          tiles.add(`${x},${y}`);
        }
      }
    }
    const node = this.spot;
    if (node) node.tiles = tiles;
    const graphics = this.scene.add.graphics().setDepth(2);
    graphics.fillStyle(0x33ccff, 0.18);
    for (const key of tiles) {
      const [x, y] = key.split(",").map(Number);
      graphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  update(): void {
    const player = this.options.player();
    const tiles = this.spot?.tiles;
    if (!player || !tiles) return;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const x = Math.floor(player.sprite.x / tileSize);
    const y = Math.floor(player.sprite.y / tileSize);
    const near = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]
      .some(([dx, dy]) => tiles.has(`${x + dx},${y + dy}`));
    if (near === this.nearZone) return;
    this.nearZone = near;
    window.dispatchEvent(new CustomEvent(near ? "phaser-fishing-zone-enter" : "phaser-fishing-zone-exit"));
  }

  isNearZone(): boolean {
    return this.nearZone;
  }

  cast(spot: FishingNode = this.spot as FishingNode): void {
    if (!spot || this.casting) return;
    const state = window.__gameStore?.getState?.()?.state as Record<string, Record<string, unknown>> | undefined;
    if (state) {
      const fishSpeed = Number((state.bonus as Record<string, number>)?.fishSpeed ?? 0);
      const cooldown = Math.max(15_000, 30_000 * (1 - fishSpeed));
      const elapsed = Date.now() - Number((state.fishing as Record<string, number>)?.lastCastAt ?? 0);
      if (elapsed < cooldown) {
        window.dispatchEvent(new CustomEvent("phaser-fishing-cooldown", {
          detail: { reason: "cooldown", remainingMs: cooldown - elapsed },
        }));
        return;
      }
      if (Number((state.stamina as Record<string, number>)?.current ?? 0) < 3) {
        window.dispatchEvent(new CustomEvent("phaser-fishing-cooldown", { detail: { reason: "stamina" } }));
        return;
      }
    }
    const sprite = this.options.player()?.sprite;
    if (!sprite) return;
    this.casting = true;
    const hasAnimation = (key: string) => this.scene.anims.exists(key);
    window.dispatchEvent(new CustomEvent("phaser-fishing-start", {
      detail: { castDurationMs: (15 + 13 + 10) * 100 },
    }));
    const play = (key: string, next: () => void) => {
      if (!hasAnimation(key)) return next();
      sprite.play(key, true);
      sprite.once("animationcomplete", next);
    };
    const caught = () => {
      dispatchUiEvent(spot.event, { spot });
      if (hasAnimation("player_idle")) sprite.play("player_idle", true);
      this.casting = false;
    };
    play("player_casting", () => play("player_reeling", () => play("player_caught", caught)));
  }

  destroy(): void {
    if (this.nearZone) window.dispatchEvent(new CustomEvent("phaser-fishing-zone-exit"));
    this.nearZone = false;
    this.casting = false;
  }

  private get spot(): FishingNode | undefined {
    return Object.values(this.options.nodes)[0];
  }
}

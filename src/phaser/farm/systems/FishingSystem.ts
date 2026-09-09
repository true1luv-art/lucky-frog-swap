import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { Player } from "@/phaser/entities/Player";
import type { FishingNode } from "@/phaser/farm/types";
import { dispatchUiEvent } from "@/phaser/farm/helpers";

interface FishingSystemOptions {
  nodes: Record<string, FishingNode>;
  /** The fishing_boundary layer from town.json — every non-empty tile is a valid cast target. */
  fishingLayer: Phaser.Tilemaps.TilemapLayer | null;
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
    const fishing = this.options.fishingLayer;
    if (!fishing) return;
    const tileSize = GAME_CONFIG.TILE_SIZE;

    // Every non-empty tile in the fishing_boundary layer is a valid cast target.
    const tiles = new Set<string>();
    for (let y = 0; y < fishing.layer.height; y += 1) {
      for (let x = 0; x < fishing.layer.width; x += 1) {
        const tile = fishing.getTileAt(x, y);
        if (tile && tile.index > 0) {
          tiles.add(`${x},${y}`);
        }
      }
    }

    const node = this.spot;
    if (node) node.tiles = tiles;

    // Draw a subtle highlight so players can see where to cast.
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

    // Must have a Rod equipped (window.__selectedItem) AND own one in tools.
    const tools = (state?.tools ?? []) as { name: string }[];
    const hasRod = tools.some((t) => t.name === "Rod");
    if (!hasRod) {
      window.dispatchEvent(new CustomEvent("phaser-fishing-cooldown", { detail: { reason: "no-rod" } }));
      return;
    }
    const equippedItem = window.__selectedItem;
    if (equippedItem !== "Rod") {
      window.dispatchEvent(new CustomEvent("phaser-fishing-cooldown", { detail: { reason: "equip-rod" } }));
      return;
    }

    if (state) {
      const cooldown = 30_000;
      const elapsed = Date.now() - Number((state.fishing as Record<string, number>)?.lastCastAt ?? 0);
      if (elapsed < cooldown) {
        window.dispatchEvent(new CustomEvent("phaser-fishing-cooldown", {
          detail: { reason: "cooldown", remainingMs: cooldown - elapsed },
        }));
        return;
      }
    }
    const player = this.options.player();
    const sprite = player?.sprite;
    if (!player || !sprite) return;
    this.faceZone(player, spot);
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

  /** Turns the player toward the nearest water tile of the fishing zone. */
  private faceZone(player: Player, spot: FishingNode): void {
    const tiles = spot.tiles;
    if (!tiles || tiles.size === 0) return;
    const ts = GAME_CONFIG.TILE_SIZE;
    const px = player.sprite.x;
    const py = player.sprite.y;

    let bestDist = Infinity;
    let bestX = px;
    let bestY = py;
    for (const key of tiles) {
      const [tx, ty] = key.split(",").map(Number);
      const cx = tx * ts + ts / 2;
      const cy = ty * ts + ts / 2;
      const dist = (cx - px) ** 2 + (cy - py) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestX = cx;
        bestY = cy;
      }
    }

    const dx = bestX - px;
    const dy = bestY - py;
    if (Math.abs(dx) >= Math.abs(dy)) {
      player.facing = dx < 0 ? "left" : "right";
      player.sprite.setFlipX(dx < 0);
    } else {
      player.facing = dy < 0 ? "up" : "down";
    }
  }

  private get spot(): FishingNode | undefined {
    return Object.values(this.options.nodes)[0];
  }
}

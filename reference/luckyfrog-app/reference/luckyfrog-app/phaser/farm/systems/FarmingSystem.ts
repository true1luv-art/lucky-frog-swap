import Phaser from "phaser";
import Decimal from "decimal.js-light";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { Player } from "@/phaser/entities/Player";
import type { PlotNode } from "@/phaser/farm/types";
import { dispatchUiEvent } from "@/phaser/farm/helpers";
import { FIELD_LEVEL_REQUIREMENTS } from "@/shared/game/experience";
import { isSeed } from "@/lib/events/plant/plant";
import type { InventoryItemName } from "@/shared/types/gameplay/game";

const CROP_HARVEST_MS: Record<string, number> = {
  potato: 60_000,
  pumpkin: 5 * 60_000,
  carrot: 10 * 60_000,
  cabbage: 30 * 60_000,
  beetroot: 60 * 60_000,
  cauliflower: 2 * 60 * 60_000,
  parsnip: 3 * 60 * 60_000,
  radish: 6 * 60 * 60_000,
  wheat: 12 * 60 * 60_000,
  kale: 24 * 60 * 60_000,
  sunflower: 24 * 60 * 60_000,
};

interface FarmingSystemOptions {
  plots: Record<string, PlotNode>;
  playerState: () => Record<string, unknown>;
  player: () => Player | undefined;
  refreshIntervalMs?: number;
}

/** Owns plot rendering, crop state, and plant/harvest interactions. */
export class FarmingSystem {
  private refreshTimer?: Phaser.Time.TimerEvent;
  private doingAction = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: FarmingSystemOptions,
  ) {}

  create(): void {
    this.spawnPlots();
    this.refreshPlots();
    this.refreshTimer = this.scene.time.addEvent({
      delay: this.options.refreshIntervalMs ?? 5_000,
      loop: true,
      callback: () => this.refreshPlots(),
    });
  }

  getHarvestMs(cropName: string): number {
    return CROP_HARVEST_MS[cropName.toLowerCase()] ?? 60_000;
  }

  getEquippedSeed(): InventoryItemName | null {
    const equipped = window.__selectedItem;
    if (!equipped || !isSeed(equipped as InventoryItemName)) return null;
    const inventory = (window.__gameStore?.getState?.()?.state as Record<string, Record<string, unknown>>)?.inventory ?? {};
    const count = new Decimal((inventory[equipped] as Decimal | number | string) ?? 0);
    return count.gte(1) ? (equipped as InventoryItemName) : null;
  }

  refreshPlot(plot: PlotNode): void {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const centerX = plot.x + tileSize / 2;
    const soilY = plot.y + tileSize;
    const fields = (window.__gameStore?.getState?.()?.state as Record<string, Record<string, unknown>>)?.fields ?? {};
    const field = fields[plot.fieldIndex] as Record<string, unknown> | undefined;

    if (!field) {
      plot.cropSprite?.destroy();
      plot.cropSprite = null;
      return;
    }

    const cropName = String(field.name ?? "").toLowerCase();
    const harvestMs = this.getHarvestMs(cropName);
    const elapsed = Date.now() - Number(field.plantedAt ?? 0);
    const stage = elapsed >= harvestMs ? "ready" : elapsed / harvestMs >= 0.5 ? "almost" : "seedling";
    const stages = [stage, "ready", "almost", "seedling"];
    const textureKey = stages
      .map((candidate) => `crop_${cropName}_${candidate}`)
      .find((candidate) => this.scene.textures.exists(candidate));
    if (!textureKey) return;

    if (!plot.cropSprite) {
      plot.cropSprite = this.scene.add.image(centerX, soilY, textureKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(tileSize, tileSize * (26 / 16))
        .setDepth(13);
    } else if (plot.cropSprite.texture.key !== textureKey) {
      plot.cropSprite.setTexture(textureKey).setDisplaySize(tileSize, tileSize * (26 / 16));
    }
  }

  interact(plot: PlotNode): void {
    if (this.doingAction) return;
    this.doingAction = true;
    const player = this.options.player();
    const sprite = player?.sprite;
    if (!player || !sprite) {
      this.doingAction = false;
      return;
    }

    const screenPoint = () => {
      const camera = this.scene.cameras.main;
      const zoom = camera.zoom;
      return {
        screenX: Math.round((plot.x + GAME_CONFIG.TILE_SIZE / 2 - camera.worldView.x) * zoom + (camera.x ?? 0)),
        screenY: Math.round((plot.y - camera.worldView.y) * zoom + (camera.y ?? 0)),
      };
    };
    const fields = (window.__gameStore?.getState?.()?.state as Record<string, Record<string, unknown>>)?.fields ?? {};
    if (!fields[plot.fieldIndex] && !this.getEquippedSeed()) {
      dispatchUiEvent("phaser-plot-noseed", { fieldIndex: plot.fieldIndex, ...screenPoint() });
      this.doingAction = false;
      return;
    }

    const facingLeft = sprite.x > plot.x + GAME_CONFIG.TILE_SIZE / 2;
    sprite.setFlipX(facingLeft);
    (player as unknown as Record<string, unknown>).facing = facingLeft ? "left" : "right";
    sprite.stop().play("player_doing", true);

    let handled = false;
    let safetyTimer: Phaser.Time.TimerEvent | null = null;
    const finish = (animation?: Phaser.Animations.Animation) => {
      if (animation?.key && animation.key !== "player_doing") return;
      if (handled) return;
      handled = true;
      sprite.off("animationcomplete", finish);
      safetyTimer?.remove(false);
      sprite.play("player_idle", true);

      const latestFields = (window.__gameStore?.getState?.()?.state as Record<string, Record<string, unknown>>)?.fields ?? {};
      const field = latestFields[plot.fieldIndex] as Record<string, unknown> | undefined;
      const cropName = field ? String(field.name ?? "").toLowerCase() : "";
      const ready = !!field && Date.now() - Number(field.plantedAt ?? 0) >= this.getHarvestMs(cropName);
      if (ready) {
        dispatchUiEvent("phaser-plot-harvest", { fieldIndex: plot.fieldIndex, amount: Number(field.amount ?? 1), ...screenPoint() });
        this.scene.sound.play("sfx_harvest", { volume: 0.5 });
      } else if (!field) {
        const seed = this.getEquippedSeed();
        if (!seed) {
          dispatchUiEvent("phaser-plot-noseed", { fieldIndex: plot.fieldIndex, ...screenPoint() });
          this.doingAction = false;
          return;
        }
        dispatchUiEvent("phaser-plot-plant", { fieldIndex: plot.fieldIndex, item: seed, ...screenPoint() });
        this.scene.sound.play("sfx_plant", { volume: 0.5 });
      }
      this.scene.time.delayedCall(100, () => this.refreshPlot(plot));
      this.scene.time.delayedCall(450, () => {
        this.refreshPlot(plot);
        this.doingAction = false;
      });
    };
    sprite.on("animationcomplete", finish);
    safetyTimer = this.scene.time.delayedCall(2_000, () => {
      if (handled) return;
      handled = true;
      sprite.off("animationcomplete", finish);
      sprite.play("player_idle", true);
      this.doingAction = false;
    });
  }

  destroy(): void {
    this.refreshTimer?.remove(false);
    this.refreshTimer = undefined;
    this.doingAction = false;
  }

  private spawnPlots(): void {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const farmingXp = (this.options.playerState().skills as Record<string, number>)?.farming ?? 0;
    let playerLevel = 1;
    let accumulatedXp = 0;
    while (playerLevel < 100) {
      accumulatedXp += Math.floor(100 * Math.pow(playerLevel, 1.6));
      if (accumulatedXp > farmingXp) break;
      playerLevel++;
    }

    for (const plot of Object.values(this.options.plots)) {
      const centerX = plot.x + tileSize / 2;
      const centerY = plot.y + tileSize / 2;
      plot.sprite = this.scene.add.image(centerX, plot.y + tileSize, "plot_soil")
        .setOrigin(0.5, 1)
        .setDisplaySize(tileSize, tileSize * (26 / 16))
        .setDepth(12);
      if (playerLevel < (FIELD_LEVEL_REQUIREMENTS[plot.fieldIndex] ?? 0)) {
        plot.lockIcon = this.scene.add.image(centerX, centerY, "plot_lock")
          .setDisplaySize(tileSize * 0.5, tileSize * 0.5)
          .setDepth(14)
          .setAlpha(0.85);
      }
    }
  }

  private refreshPlots(): void {
    for (const plot of Object.values(this.options.plots)) this.refreshPlot(plot);
  }
}

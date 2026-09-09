import Phaser from "phaser";
import Decimal from "decimal.js-light";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { Player } from "@/phaser/entities/Player";
import type { PlotNode } from "@/phaser/farm/types";
import { dispatchUiEvent } from "@/phaser/farm/helpers";
import { getPlotFarmLevelRequirement } from "@/features/game/farm-level";
import { isSeed } from "@/features/events/plant/plant";
import { screenTracker } from "@/features/utils/screen";
import type { InventoryItemName } from "@/features/types/gameplay/game";

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
    const inventory = (window.__gameStore?.getState?.()?.state as Record<string, Record<string, unknown>>)?.items ?? {};
    const count = new Decimal((inventory[equipped] as Decimal | number | string) ?? 0);
    return count.gte(1) ? (equipped as InventoryItemName) : null;
  }

  refreshPlot(plot: PlotNode): void {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const centerX  = plot.x + tileSize / 2;
    const soilY    = plot.y + tileSize;
    const fields   = (window.__gameStore?.getState?.()?.state as Record<string, Record<string, unknown>>)?.fields ?? {};
    const field    = fields[plot.fieldIndex] as Record<string, unknown> | undefined;

    if (!field) {
      plot.cropSprite?.destroy();
      plot.cropSprite = null;
      plot.waterIcon?.setVisible(false);
      return;
    }

    const cropName  = String(field.name ?? "").toLowerCase();
    const isWatered = Boolean(field.isWatered ?? false);
    const wateredAt = Number(field.wateredAt ?? 0);
    const growthMs  = this.getHarvestMs(cropName);
    const now       = Date.now();
    const readyAt   = wateredAt + growthMs;

    // Mechanic: growth only starts once isWatered === true.
    const needsWater = !isWatered;
    const ready      = isWatered && now >= readyAt;
    const progress   = isWatered ? Math.min(1, (now - wateredAt) / growthMs) : 0;
    const stage      = ready ? "ready" : (isWatered && progress >= 0.5) ? "almost" : "seedling";

    const stages     = [stage, "ready", "almost", "seedling"];
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

    // Water icon — shown above the crop when the plot needs watering.
    const ICON_SIZE  = tileSize * 0.55;
    const iconY      = soilY - tileSize * 1.6;
    const WATER_TEX  = "tool_watering_can";

    if (needsWater) {
      if (!plot.waterIcon) {
        // Try watering can texture; fall back gracefully if not loaded yet.
        const tex = this.scene.textures.exists(WATER_TEX) ? WATER_TEX : "plot_soil";
        plot.waterIcon = this.scene.add.image(centerX, iconY, tex)
          .setDisplaySize(ICON_SIZE, ICON_SIZE)
          .setDepth(15)
          .setVisible(true);
      } else {
        plot.waterIcon
          .setPosition(centerX, iconY)
          .setVisible(true);
      }
    } else {
      plot.waterIcon?.setVisible(false);
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
      const field      = latestFields[plot.fieldIndex] as Record<string, unknown> | undefined;
      const isWatered  = field ? Boolean(field.isWatered ?? false) : false;
      const wateredAt  = field ? Number(field.wateredAt ?? 0) : 0;
      const cropName   = field ? String(field.name ?? "").toLowerCase() : "";
      const growthMs   = cropName ? this.getHarvestMs(cropName) : 0;
      const ready      = !!field && isWatered && wateredAt > 0 && Date.now() >= wateredAt + growthMs;

      if (ready) {
        dispatchUiEvent("phaser-plot-harvest", { fieldIndex: plot.fieldIndex, amount: Number(field.amount ?? 1), ...screenPoint() });
        this.scene.sound.play("sfx_harvest", { volume: 0.5 });
      } else if (field && !isWatered) {
        // Planted but not yet watered — check watering can ownership + equip before dispatching.
        const gameState    = window.__gameStore?.getState?.()?.state as { tools?: { name: string }[] } | undefined;
        const tools        = gameState?.tools ?? [];
        const REQUIRED     = "Watering Can";
        const hasCan       = tools.some((t) => t.name === REQUIRED);
        const equippedItem = window.__selectedItem;

        if (!hasCan) {
          dispatchUiEvent("phaser-no-tool", { tool: REQUIRED, nodeType: "field", reason: "no-tool" });
          this.doingAction = false;
          return;
        }
        if (equippedItem !== REQUIRED) {
          dispatchUiEvent("phaser-no-tool", { tool: REQUIRED, nodeType: "field", reason: "not-equipped" });
          this.doingAction = false;
          return;
        }

        dispatchUiEvent("phaser-plot-water", { fieldIndex: plot.fieldIndex, ...screenPoint() });
        this.scene.sound.play("sfx_plant", { volume: 0.4 });
      } else if (!field) {
        const seed = this.getEquippedSeed();
        if (!seed) {
          dispatchUiEvent("phaser-plot-noseed", { fieldIndex: plot.fieldIndex, ...screenPoint() });
          this.doingAction = false;
          return;
        }
        // Reset the anti-bot tracker so the click on Phaser canvas doesn't
        // trigger a false "collinear movement" rejection in plant().
        screenTracker.reset();
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
    const tileSize  = GAME_CONFIG.TILE_SIZE;
    const farmLevel = (this.options.playerState().farmLevel as number | undefined) ?? 1;

    for (const plot of Object.values(this.options.plots)) {
      const centerX = plot.x + tileSize / 2;
      const centerY = plot.y + tileSize / 2;
      plot.sprite = this.scene.add.image(centerX, plot.y + tileSize, "plot_soil")
        .setOrigin(0.5, 1)
        .setDisplaySize(tileSize, tileSize * (26 / 16))
        .setDepth(12);
      if (farmLevel < getPlotFarmLevelRequirement(plot.fieldIndex)) {
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

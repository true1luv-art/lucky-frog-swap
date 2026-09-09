import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { Player } from "@/phaser/entities/Player";
import type { AnimalNode, AnimalType, MobileHint, NodeTooltipData, PlotNode } from "@/phaser/farm/types";
import {
  CHICKEN_SPAWN_POSITIONS,
  COW_SPAWN_POSITIONS,
  SHEEP_SPAWN_POSITIONS,
} from "@/phaser/positions";

interface AnimalSystemOptions {
  nodes: Record<string, AnimalNode>;
  player: () => Player | undefined;
}

type AnimalState = Record<string, Record<string, Record<string, number>>>;

const ANIMAL_DEPTH = 18;
const ICON_SIZE = 8;
const PRODUCE_MS: Record<AnimalType, number> = { chicken: 60_000, cow: 90_000, sheep: 120_000 };
const RE_HUNGER_MS: Record<AnimalType, number> = {
  chicken: 4 * 60 * 60 * 1000,
  cow: 6 * 60 * 60 * 1000,
  sheep: 6 * 60 * 60 * 1000,
};
const STATE_KEY: Record<AnimalType, string> = { chicken: "chickens", cow: "cows", sheep: "sheep" };
const ANIMATION_KEY: Record<AnimalType, string> = {
  chicken: "walk_chicken",
  cow: "walk_cow",
  sheep: "walk_sheep",
};
const WALK_SPEED: Record<AnimalType, number> = { chicken: 16, cow: 10, sheep: 12 };
const CROP_TEXTURE: Record<AnimalType, string> = {
  chicken: "feed_wheat",
  cow: "feed_kale",
  sheep: "feed_cabbage",
};
const FEED_EVENT: Record<AnimalType, string> = {
  chicken: "chicken.feed",
  cow: "cow.feed",
  sheep: "sheep.feed",
};
const COLLECT_EVENT: Record<AnimalType, string> = {
  chicken: "chicken.collectEgg",
  cow: "cow.collectMilk",
  sheep: "sheep.collectWool",
};
const PRODUCE_LABEL: Record<AnimalType, string> = { chicken: "Egg", cow: "Milk", sheep: "Wool" };
const PRODUCE_ICON: Record<AnimalType, string> = {
  chicken: "/assets/resources/egg.png",
  cow: "/assets/resources/milk.png",
  sheep: "/assets/resources/wool.png",
};
const FEED_ICON: Record<AnimalType, string> = {
  chicken: "/assets/crops/wheat/seed.png",
  cow: "/assets/crops/kale/seed.png",
  sheep: "/assets/crops/cabbage/seed.png",
};

/** Owns animal sprites, roaming, store synchronization, status, and actions. */
export class AnimalSystem {
  private unsubscribe?: (() => void) | null;
  private readonly proximityNodes: Record<string, PlotNode> = {};
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: AnimalSystemOptions,
  ) {}

  create(): void {
    this.destroyed = false;
    const definitions = [
      { key: "walk_chicken", texture: "animal_chicken", frameRate: 6 },
      { key: "walk_sheep", texture: "animal_sheep", frameRate: 5 },
      { key: "walk_cow", texture: "animal_cow", frameRate: 5 },
    ];
    for (const definition of definitions) {
      if (!this.scene.anims.exists(definition.key)) {
        this.scene.anims.create({
          key: definition.key,
          frames: this.scene.anims.generateFrameNumbers(definition.texture, { start: 0, end: 3 }),
          frameRate: definition.frameRate,
          repeat: -1,
        });
      }
    }
    this.syncSprites();
    this.unsubscribe = window.__gameStore?.subscribe?.(() => this.syncSprites()) ?? null;
  }

  update(): void {
    const state = this.getState();
    if (!state) return;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const iconOffsetY = tileSize / 2 + 2 + ICON_SIZE / 2;
    for (const [key, node] of Object.entries(this.options.nodes)) {
      if (!node.sprite?.active) continue;
      const status = this.getStatus(node, state);
      node.cropIcon?.setPosition(node.sprite.x, node.sprite.y - iconOffsetY);
      node.exprIcon?.setPosition(node.sprite.x, node.sprite.y - iconOffsetY - ICON_SIZE - 1);
      node.cropIcon?.setVisible(status === "hungry");
      if (status === "happy") {
        node.exprIcon?.setTexture("expr_happy").setVisible(true);
      } else if (status === "ready") {
        node.exprIcon?.setTexture("expr_alerted").setVisible(true);
      } else {
        node.exprIcon?.setVisible(false);
      }
      this.updateProximityNode(key, node);
    }
  }

  getProximityNodes(): Record<string, PlotNode> {
    return this.proximityNodes;
  }

  hitTest(worldX: number, worldY: number): AnimalNode | null {
    const half = GAME_CONFIG.TILE_SIZE;
    return Object.values(this.options.nodes).find((node) =>
      Boolean(node.sprite?.active) &&
      Math.abs(worldX - node.sprite!.x) <= half &&
      Math.abs(worldY - node.sprite!.y) <= half,
    ) ?? null;
  }

  isInRange(node: AnimalNode): boolean {
    const player = this.options.player();
    if (!player || !node.sprite?.active) return false;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const playerX = Math.floor(player.sprite.x / tileSize);
    const playerY = Math.floor(player.sprite.y / tileSize);
    const animalX = Math.floor(node.sprite.x / tileSize);
    const animalY = Math.floor(node.sprite.y / tileSize);
    return Math.max(Math.abs(playerX - animalX), Math.abs(playerY - animalY)) <= 2;
  }

  findNearby(type?: string): AnimalNode | null {
    return Object.values(this.options.nodes).find((node) =>
      (!type || node.type === type) && this.isInRange(node),
    ) ?? null;
  }

  interact(node: AnimalNode): void {
    const state = this.getState();
    const dispatch = window.__gameStore?.getState?.()?.dispatch;
    if (!state || !dispatch) return;
    const status = this.getStatus(node, state);
    try {
      if (status === "ready") dispatch({ type: COLLECT_EVENT[node.type], index: node.index });
      else if (status === "hungry") dispatch({ type: FEED_EVENT[node.type], index: node.index });
    } catch {
      // The store rejects actions when feed is unavailable or produce was already collected.
    }
  }

  getMobileHint(): MobileHint | null {
    const state = this.getState();
    if (!state) return null;
    for (const node of Object.values(this.options.nodes)) {
      if (!this.isInRange(node)) continue;
      const status = this.getStatus(node, state);
      if (status === "ready") return { type: "collect", icon: PRODUCE_ICON[node.type], animal: node.type };
      if (status === "hungry") return { type: "feed", icon: FEED_ICON[node.type], animal: node.type };
    }
    return null;
  }

  getTooltip(worldX: number, worldY: number, range: number): NodeTooltipData | null {
    const player = this.options.player();
    const state = this.getState();
    if (!player || !state) return null;
    const node = Object.values(this.options.nodes).find((animal) => {
      if (!animal.sprite?.active) return false;
      if (Math.abs(player.sprite.x - animal.sprite.x) > range || Math.abs(player.sprite.y - animal.sprite.y) > range) return false;
      const half = GAME_CONFIG.TILE_SIZE;
      return worldX >= animal.sprite.x - half && worldX < animal.sprite.x + half &&
        worldY >= animal.sprite.y - half && worldY < animal.sprite.y + half;
    });
    if (!node?.sprite) return null;
    const status = this.getStatus(node, state);
    if (status !== "happy") return null;
    const record = state[STATE_KEY[node.type]]?.[node.index];
    return {
      kind: "animal",
      animalType: node.type,
      produceName: PRODUCE_LABEL[node.type],
      produceIcon: PRODUCE_ICON[node.type],
      fedAt: record?.fedAt ?? 0,
      produceMs: PRODUCE_MS[node.type] * this.getSpeedFactor(state),
      screenX: node.sprite.x,
      screenY: node.sprite.y,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const [key, node] of Object.entries(this.options.nodes)) {
      node._timer?.remove?.();
      if (node.sprite) this.scene.tweens.killTweensOf(node.sprite);
      node.sprite?.destroy();
      node.cropIcon?.destroy();
      node.exprIcon?.destroy();
      delete this.options.nodes[key];
      delete this.proximityNodes[key];
    }
  }

  private syncSprites(): void {
    const state = this.getState();
    if (!state || this.destroyed) return;
    this.syncGroup(CHICKEN_SPAWN_POSITIONS, "chicken", "Chicken", 10, state);
    this.syncGroup(COW_SPAWN_POSITIONS, "cow", "Cow", 5, state);
    this.syncGroup(SHEEP_SPAWN_POSITIONS, "sheep", "Sheep", 5, state);
  }

  private syncGroup(
    positions: unknown[],
    type: AnimalType,
    inventoryKey: string,
    maxCount: number,
    state: AnimalState,
  ): void {
    const count = Math.min(Number((state.inventory as unknown as Record<string, unknown>)?.[inventoryKey] ?? 0), maxCount);
    positions.forEach((_position, index) => {
      const key = `${type}_${index}`;
      const existing = this.options.nodes[key];
      if (index < count && !existing) this.spawn(key, type, index);
      else if (index >= count && existing) this.remove(key, existing);
    });
  }

  private spawn(key: string, type: AnimalType, index: number): void {
    const bounds = this.getPenBounds(type);
    const seed = index * 12345;
    const x = bounds.minX + ((seed % 100) / 100) * (bounds.maxX - bounds.minX);
    const y = bounds.minY + (((seed * 7) % 100) / 100) * (bounds.maxY - bounds.minY);
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const iconOffsetY = tileSize / 2 + 2 + ICON_SIZE / 2;
    const sprite = this.scene.add.sprite(x, y, `animal_${type}`)
      .setDepth(ANIMAL_DEPTH)
      .setDisplaySize(tileSize * 2, tileSize * 2)
      .play(ANIMATION_KEY[type]);
    const cropIcon = this.scene.add.image(x, y - iconOffsetY, CROP_TEXTURE[type])
      .setDisplaySize(ICON_SIZE, ICON_SIZE)
      .setDepth(ANIMAL_DEPTH + 1)
      .setVisible(false);
    const exprIcon = this.scene.add.image(x, y - iconOffsetY - ICON_SIZE - 1, "expr_stress")
      .setDisplaySize(ICON_SIZE, ICON_SIZE)
      .setDepth(ANIMAL_DEPTH + 1)
      .setVisible(false);
    const node: AnimalNode = { type, index, sprite, cropIcon, exprIcon, _timer: null };
    this.options.nodes[key] = node;
    this.updateProximityNode(key, node);
    this.scheduleMove(node);
  }

  private remove(key: string, node: AnimalNode): void {
    node._timer?.remove?.();
    if (node.sprite) this.scene.tweens.killTweensOf(node.sprite);
    node.sprite?.destroy();
    node.cropIcon?.destroy();
    node.exprIcon?.destroy();
    delete this.options.nodes[key];
    delete this.proximityNodes[key];
  }

  private scheduleMove(node: AnimalNode): void {
    if (!node.sprite?.active || this.destroyed) return;
    const idleMs = 2000 + Math.random() * 4000;
    node.sprite.anims.pause();
    node._timer = this.scene.time.delayedCall(idleMs, () => {
      if (!node.sprite?.active || this.destroyed) return;
      const bounds = this.getPenBounds(node.type);
      const targetX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const targetY = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
      const distance = Math.hypot(targetX - node.sprite.x, targetY - node.sprite.y);
      node.sprite.setFlipX(targetX > node.sprite.x).anims.resume();
      this.scene.tweens.add({
        targets: node.sprite,
        x: targetX,
        y: targetY,
        duration: Math.max(500, (distance / WALK_SPEED[node.type]) * 1000),
        ease: "Linear",
        onComplete: () => this.scheduleMove(node),
      });
    });
  }

  private updateProximityNode(key: string, node: AnimalNode): void {
    if (!node.sprite?.active) return;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const proxy = this.proximityNodes[key];
    if (proxy) {
      proxy.x = node.sprite.x - tileSize;
      proxy.y = node.sprite.y - tileSize;
      proxy.sprite = node.sprite as unknown as Phaser.GameObjects.Image;
      return;
    }
    this.proximityNodes[key] = {
      plotId: key,
      fieldIndex: node.index,
      isDepleted: false,
      requiredLevel: 0,
      x: node.sprite.x - tileSize,
      y: node.sprite.y - tileSize,
      width: tileSize * 2,
      height: tileSize * 2,
      sprite: node.sprite as unknown as Phaser.GameObjects.Image,
    };
  }

  private getStatus(node: AnimalNode, state: AnimalState): "hungry" | "ready" | "happy" {
    const record = state[STATE_KEY[node.type]]?.[node.index];
    const fedAt = record?.fedAt ?? 0;
    const elapsed = fedAt ? Date.now() - fedAt : Infinity;
    const produceMs = PRODUCE_MS[node.type] * this.getSpeedFactor(state);
    if (!fedAt || elapsed >= produceMs + RE_HUNGER_MS[node.type]) return "hungry";
    if (elapsed >= produceMs) return "ready";
    return "happy";
  }

  private getSpeedFactor(state: AnimalState): number {
    return Math.max(0, 1 - Number((state.bonus as unknown as Record<string, number>)?.produceSpeed ?? 0));
  }

  private getState(): AnimalState | undefined {
    return window.__gameStore?.getState?.()?.state as AnimalState | undefined;
  }

  private getPenBounds(type: AnimalType) {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    return {
      chicken: { minX: 50 * tileSize, maxX: 58 * tileSize, minY: 30 * tileSize, maxY: 32 * tileSize },
      cow: { minX: 51 * tileSize, maxX: 57 * tileSize, minY: 33 * tileSize, maxY: 35 * tileSize },
      sheep: { minX: 50 * tileSize, maxX: 58 * tileSize, minY: 36 * tileSize, maxY: 37 * tileSize },
    }[type];
  }
}

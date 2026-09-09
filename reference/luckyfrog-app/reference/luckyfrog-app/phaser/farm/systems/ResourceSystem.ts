import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { Player } from "@/phaser/entities/Player";
import type { ResourceNode } from "@/phaser/farm/types";
import { dispatchUiEvent } from "@/phaser/farm/helpers";
import {
  GOLD_RECOVERY_SECONDS,
  IRON_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
  TREE_RECOVERY_SECONDS,
} from "@/shared/data/farming";

interface ResourceSystemOptions {
  trees: Record<string, ResourceNode>;
  stones: Record<string, ResourceNode>;
  player: () => Player | undefined;
}

const RECOVERY_SECONDS: Record<string, number> = {
  tree: TREE_RECOVERY_SECONDS,
  stone: STONE_RECOVERY_SECONDS,
  iron: IRON_RECOVERY_SECONDS,
  gold: GOLD_RECOVERY_SECONDS,
};

/** Owns resource rendering, persisted depletion state, and strike interactions. */
export class ResourceSystem {
  private strikeLocked = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: ResourceSystemOptions,
  ) {}

  create(): void {
    this.createAnimations();
    this.spawnResources();
    this.restoreDepletedResources();
  }

  strike(node: ResourceNode): void {
    if (!node || node.isDepleted || this.strikeLocked) return;
    this.strikeLocked = true;
    node.hitCount = (node.hitCount ?? 0) + 1;

    const hitCount = node.hitCount;
    const depleting = hitCount >= 3;
    const isTree = node.type === "tree";
    const player = this.options.player();
    const sprite = player?.sprite;
    const nodeCenterX = node.x + GAME_CONFIG.TILE_SIZE;
    const facingLeft = (sprite?.x ?? nodeCenterX) > nodeCenterX;
    sprite?.setFlipX(facingLeft);
    if (player) (player as unknown as Record<string, unknown>).facing = facingLeft ? "left" : "right";

    const applyVisual = () => {
      if (depleting) {
        node.isDepleted = true;
        node.depletedAt = Date.now();
        node.progressOverlay?.setVisible(false);
        this.showDepletedSprite(node);
        this.playDropAnimation(node, facingLeft ? "left" : "right");
        this.dispatchDrop(node);
      } else {
        node.progressOverlay?.setTexture(hitCount === 1 ? "progress_quarter" : "progress_almost").setVisible(true);
      }
      this.scene.sound.play(
        isTree
          ? depleting ? "sfx_tree_fall" : "sfx_chop"
          : depleting ? "sfx_mining_fall" : "sfx_mining",
        { volume: 0.3 },
      );
    };

    const actionKey = isTree ? "player_axe" : "player_mine";
    if (sprite && this.scene.anims.exists(actionKey)) {
      sprite.play(actionKey, true);
      sprite.once("animationcomplete", () => {
        applyVisual();
        if (this.scene.anims.exists("player_idle")) sprite.play("player_idle", true);
        this.strikeLocked = false;
      });
      return;
    }
    applyVisual();
    this.strikeLocked = false;
  }

  destroy(): void {
    this.strikeLocked = false;
  }

  private createAnimations(): void {
    for (const type of ["stone", "iron", "gold", "tree"]) {
      const key = `anim_drop_${type}`;
      if (!this.scene.anims.exists(key) && this.scene.textures.exists(`drop_${type}`)) {
        this.scene.anims.create({
          key,
          frames: this.scene.anims.generateFrameNumbers(`drop_${type}`, { start: 0, end: 6 }),
          frameRate: 12,
          repeat: 0,
        });
      }
    }
  }

  private spawnResources(): void {
    for (const node of Object.values(this.options.trees)) {
      this.spawnNode(node, "tree", "tree_node");
    }
    for (const node of Object.values(this.options.stones)) {
      const id = String(node.nodeId ?? "");
      const type = id.startsWith("gold") ? "gold" : id.startsWith("iron") ? "iron" : "stone";
      this.spawnNode(node, type, `${type}_rock`);
    }
  }

  private spawnNode(node: ResourceNode, type: string, texture: string): void {
    node.type = type;
    node.hitCount = 0;
    node.isDepleted = false;
    const centerX = node.x + GAME_CONFIG.TILE_SIZE;
    const centerY = node.y + GAME_CONFIG.TILE_SIZE;
    node.sprite = this.scene.add.image(centerX, centerY, this.scene.textures.exists(texture) ? texture : "__DEFAULT")
      .setDisplaySize(32, 32)
      .setOrigin(0.5)
      .setDepth(14);
    node.progressOverlay = this.scene.add.image(centerX, centerY + 21, "progress_quarter")
      .setDisplaySize(15, 7)
      .setOrigin(0.5)
      .setDepth(15)
      .setVisible(false);
  }

  private restoreDepletedResources(): void {
    const state = window.__gameStore?.getState?.()?.state as Record<string, Record<string, Record<string, number>>> | undefined;
    if (!state) return;
    const now = Date.now();
    const markDepleted = (node: ResourceNode, timestamp: number) => {
      node.isDepleted = true;
      node.depletedAt = timestamp;
      node.hitCount = 3;
      this.showDepletedSprite(node);
      node.progressOverlay?.setVisible(false);
    };
    for (const node of Object.values(this.options.trees)) {
      const index = this.nodeIndex(node);
      if (index < 0) continue;
      const choppedAt = (state.trees?.[index] as Record<string, number>)?.choppedAt ?? 0;
      if (choppedAt > 0 && now < choppedAt + RECOVERY_SECONDS.tree * 1_000) markDepleted(node, choppedAt);
    }
    for (const node of Object.values(this.options.stones)) {
      const index = this.nodeIndex(node);
      if (index < 0) continue;
      const type = node.type ?? "stone";
      const storeKey = type === "iron" ? "iron" : type === "gold" ? "gold" : "stones";
      const minedAt = (state[storeKey]?.[index] as Record<string, number>)?.minedAt ?? 0;
      if (minedAt > 0 && now < minedAt + (RECOVERY_SECONDS[type] ?? STONE_RECOVERY_SECONDS) * 1_000) {
        markDepleted(node, minedAt);
      }
    }
  }

  private dispatchDrop(node: ResourceNode): void {
    const state = window.__gameStore?.getState?.()?.state as Record<string, Record<string, Record<string, unknown>>> | undefined;
    const index = this.nodeIndex(node);
    const toNumber = (value: unknown) => {
      if (typeof value === "number") return value;
      if (value && typeof (value as { toNumber?: () => number }).toNumber === "function") {
        return (value as { toNumber: () => number }).toNumber();
      }
      return 1;
    };
    let amount = 1;
    if (state && index >= 0) {
      if (node.type === "tree") amount = toNumber(state.trees?.[index]?.wood);
      if (node.type === "stone") amount = toNumber(state.stones?.[index]?.amount);
      if (node.type === "iron") amount = toNumber(state.iron?.[index]?.amount);
      if (node.type === "gold") amount = toNumber(state.gold?.[index]?.amount);
    }
    const camera = this.scene.cameras.main;
    const zoom = camera.zoom;
    dispatchUiEvent("phaser-resource-drop", {
      nodeType: node.type,
      nodeId: node.nodeId,
      amount,
      screenX: Math.round((node.x + GAME_CONFIG.TILE_SIZE / 2 - camera.worldView.x) * zoom + (camera.x ?? 0)),
      screenY: Math.round((node.y - camera.worldView.y) * zoom + (camera.y ?? 0)),
    });
  }

  private showDepletedSprite(node: ResourceNode): void {
    const texture = `${node.type}_empty`;
    if (node.sprite && this.scene.textures.exists(texture)) {
      (node.sprite as Phaser.GameObjects.Image).setTexture(texture).setAlpha(1);
    }
  }

  private playDropAnimation(node: ResourceNode, facing: "left" | "right"): void {
    const type = node.type ?? "stone";
    const animation = `anim_drop_${type}`;
    if (!this.scene.anims.exists(animation)) return;
    const facingLeft = facing === "left";
    const sprite = this.scene.add.sprite(
      facingLeft ? node.x + GAME_CONFIG.TILE_SIZE * 2 : node.x,
      node.y + GAME_CONFIG.TILE_SIZE,
      `drop_${type}`,
      0,
    ).setFlipX(facingLeft).setOrigin(facingLeft ? 1 : 0, 0.5).setDepth(16);
    sprite.play(animation);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  }

  private nodeIndex(node: ResourceNode): number {
    const value = Number.parseInt(String(node.nodeId ?? "").replace(/\D/g, ""), 10);
    return Number.isNaN(value) ? -1 : value - 1;
  }
}

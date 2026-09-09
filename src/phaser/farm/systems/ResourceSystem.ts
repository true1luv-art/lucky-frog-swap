import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { Player } from "@/phaser/entities/Player";
import type { ResourceNode } from "@/phaser/farm/types";
import { dispatchUiEvent } from "@/phaser/farm/helpers";
import {
  STONE_RECOVERY_SECONDS,
  TREE_RECOVERY_SECONDS,
  CHOP_ACTION_MS,
  MINE_ACTION_MS,
} from "@/features/game/resources";

interface ResourceSystemOptions {
  trees: Record<string, ResourceNode>;
  stones: Record<string, ResourceNode>;
  player: () => Player | undefined;
  /** Called when a node is depleted so its physics body can be removed. */
  onNodeDepleted?: (node: ResourceNode) => void;
  /** Called when a depleted node is restored so its physics body can be re-added. */
  onNodeRestored?: (node: ResourceNode) => void;
}

// All stone positions use the same recovery time regardless of what ore dropped.
const RECOVERY_SECONDS: Record<string, number> = {
  tree:  TREE_RECOVERY_SECONDS,
  stone: STONE_RECOVERY_SECONDS,
};

/**
 * Owns resource rendering, persisted depletion state, and strike interactions.
 *
 * Strike model:
 *  - 3 hits required to deplete a node and receive a reward.
 *  - Each hit is gated by (CHOP_ACTION_MS / 3) for trees or (MINE_ACTION_MS / 3)
 *    for stones — preserving the full 5 s window across 3 interactive steps.
 *  - Requires the matching tool (Axe for trees, Pickaxe for stones) to be equipped.
 *  - A small progress bar overlay below the node shows hit 1 (quarter) and hit 2 (almost).
 */
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

    const isTree   = node.type === "tree";
    const perHitMs = (isTree ? CHOP_ACTION_MS : MINE_ACTION_MS) / 3;
    const now      = Date.now();

    // ── Per-hit cooldown gate ─────────────────────────────────────────
    if (now - (node.lastHitAt ?? 0) < perHitMs) return;

    // ── Tool requirement check ────────────────────────────────────────
    const gameState = window.__gameStore?.getState?.()?.state as
      | { tools?: { name: string }[] }
      | undefined;
    const tools = gameState?.tools ?? [];
    const requiredTool = isTree ? "Axe" : "Pickaxe";
    const hasTool      = tools.some((t) => t.name === requiredTool);
    const equippedItem = window.__selectedItem;

    if (!hasTool) {
      dispatchUiEvent("phaser-no-tool", { tool: requiredTool, nodeType: node.type, reason: "no-tool" });
      return;
    }

    // Player must also have the correct tool equipped (selected via inventory).
    if (equippedItem !== requiredTool) {
      dispatchUiEvent("phaser-no-tool", { tool: requiredTool, nodeType: node.type, reason: "not-equipped" });
      return;
    }

    this.strikeLocked    = true;
    node.lastHitAt       = now;
    node.hitCount        = (node.hitCount ?? 0) + 1;

    const hitCount  = node.hitCount;
    const depleting = hitCount >= 3;
    const player    = this.options.player();
    const sprite    = player?.sprite;
    const nodeCenterX = node.x + GAME_CONFIG.TILE_SIZE;
    const facingLeft  = (sprite?.x ?? nodeCenterX) > nodeCenterX;
    sprite?.setFlipX(facingLeft);
    if (player) (player as unknown as Record<string, unknown>).facing = facingLeft ? "left" : "right";

    const applyVisual = () => {
      if (depleting) {
        node.isDepleted = true;
        node.depletedAt = now;
        // Node is gone — cancel the idle-reset timer, nothing to reset.
        node.idleResetTimer?.remove(false);
        node.idleResetTimer = undefined;
        node.progressOverlay?.setVisible(false);
        this.showDepletedSprite(node);
        this.playDropAnimation(node, facingLeft ? "left" : "right");
        this.dispatchDrop(node);
        this.options.onNodeDepleted?.(node);
        // Schedule automatic replenishment.
        this.scheduleReplenish(node);
      } else {
        // Show progress bar — quarter fill on hit 1, almost-full on hit 2.
        node.progressOverlay
          ?.setTexture(hitCount === 1 ? "progress_quarter" : "progress_almost")
          .setVisible(true);
        // (Re-)schedule 10 s idle reset so progress clears if player walks away.
        this.scheduleIdleReset(node);
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

  // ── Replenishment ─────────────────────────────────────────────────────────

  /**
   * Schedules replenishment of a depleted node.
   * If the node was already depleted before this session (depletedAt is in the
   * past) the remaining delay is computed so it fires at the right wall-clock time.
   */
  private scheduleReplenish(node: ResourceNode): void {
    // Cancel any previously-scheduled replenishment for this node.
    node.replenishTimer?.remove(false);

    const recoverySecs = RECOVERY_SECONDS[node.type ?? "stone"] ?? STONE_RECOVERY_SECONDS;
    const depletedAt   = node.depletedAt ?? Date.now();
    const elapsed      = Date.now() - depletedAt;
    const delayMs      = Math.max(0, recoverySecs * 1_000 - elapsed);

    node.replenishTimer = this.scene.time.delayedCall(
      delayMs,
      () => this.restoreNode(node),
    );
  }

  /**
   * Restores a depleted resource node: resets state, swaps back to the live
   * sprite, re-adds the physics collider, and notifies the scene.
   */
  private restoreNode(node: ResourceNode): void {
    node.isDepleted    = false;
    node.depletedAt    = undefined;
    node.hitCount      = 0;
    node.lastHitAt     = 0;
    node.replenishTimer = undefined;

    const texture = node.type === "tree" ? "tree_node" : "stone_rock";
    if (node.sprite && this.scene.textures.exists(texture)) {
      (node.sprite as Phaser.GameObjects.Image)
        .setTexture(texture)
        .setAlpha(1);
    }
    node.progressOverlay?.setVisible(false);
    this.options.onNodeRestored?.(node);
  }

  // ── Idle reset helpers ────────────────────────────────────────────────────

  /**
   * Clears hit progress on a node: resets hitCount to 0 and hides the
   * progress overlay. Called by the idle-reset timer after 10 s of no hits.
   */
  private resetNodeProgress(node: ResourceNode): void {
    node.hitCount = 0;
    node.progressOverlay?.setVisible(false);
    node.idleResetTimer = undefined;
  }

  /**
   * (Re-)schedules the 10 s idle-reset timer for a node.
   * Removes any existing timer before adding the new one so rapid
   * hits push the deadline forward rather than stacking timers.
   */
  private scheduleIdleReset(node: ResourceNode): void {
    node.idleResetTimer?.remove(false);
    node.idleResetTimer = this.scene.time.delayedCall(
      10_000,
      () => this.resetNodeProgress(node),
    );
  }

  private createAnimations(): void {
    for (const type of ["stone", "tree"]) {
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
    // All stone positions use the same sprite — ore drops are determined by
    // pickaxe tier at mine time, not by the node itself.
    for (const node of Object.values(this.options.stones)) {
      this.spawnNode(node, "stone", "stone_rock");
    }
  }

  private spawnNode(node: ResourceNode, type: string, texture: string): void {
    node.type       = type;
    node.hitCount   = 0;
    node.lastHitAt  = 0;
    node.isDepleted = false;
    const centerX = node.x + GAME_CONFIG.TILE_SIZE;
    const centerY = node.y + GAME_CONFIG.TILE_SIZE;
    // Fixed low depth — the player (Y-sorted to sprite.y each frame) always
    // renders above stones and trees, never behind them.
    node.sprite = this.scene.add.image(centerX, centerY, this.scene.textures.exists(texture) ? texture : "__DEFAULT")
      .setDisplaySize(32, 32)
      .setOrigin(0.5)
      .setDepth(0);
    // Progress overlay sits just above its node but still below the player.
    node.progressOverlay = this.scene.add.image(centerX, centerY + 21, "progress_quarter")
      .setDisplaySize(15, 7)
      .setOrigin(0.5)
      .setDepth(1)
      .setVisible(false);
  }

  private restoreDepletedResources(): void {
    const state = window.__gameStore?.getState?.()?.state as Record<string, Record<string, Record<string, number>>> | undefined;
    if (!state) return;
    const now = Date.now();

    const markDepletedAndSchedule = (node: ResourceNode, timestamp: number) => {
      node.isDepleted = true;
      node.depletedAt = timestamp;
      node.hitCount   = 3;
      node.lastHitAt  = timestamp;
      node.progressOverlay?.setVisible(false);
      this.showDepletedSprite(node);
      // Schedule remaining recovery time so the node comes back automatically.
      this.scheduleReplenish(node);
    };

    for (const node of Object.values(this.options.trees)) {
      const index = this.nodeIndex(node);
      if (index < 0) continue;
      const choppedAt = (state.trees?.[index] as Record<string, number>)?.choppedAt ?? 0;
      if (choppedAt > 0 && now < choppedAt + RECOVERY_SECONDS.tree * 1_000) {
        markDepletedAndSchedule(node, choppedAt);
      }
    }
    for (const node of Object.values(this.options.stones)) {
      const index = this.nodeIndex(node);
      if (index < 0) continue;
      const minedAt = (state.stones?.[index] as Record<string, number>)?.minedAt ?? 0;
      if (minedAt > 0 && now < minedAt + STONE_RECOVERY_SECONDS * 1_000) {
        markDepletedAndSchedule(node, minedAt);
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
      if (node.type === "tree")  amount = toNumber(state.trees?.[index]?.wood);
      if (node.type === "stone") amount = toNumber(state.stones?.[index]?.amount);
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
    // Depth 9999 — always above any Y-sorted sprite in the 0-640 depth range.
    ).setFlipX(facingLeft).setOrigin(facingLeft ? 1 : 0, 0.5).setDepth(9999);
    sprite.play(animation);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  }

  private nodeIndex(node: ResourceNode): number {
    const value = Number.parseInt(String(node.nodeId ?? "").replace(/\D/g, ""), 10);
    return Number.isNaN(value) ? -1 : value - 1;
  }
}

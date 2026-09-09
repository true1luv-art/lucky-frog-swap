import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import * as Loaders from "@/phaser/loaders/index";
import { AnimationSystem } from "@/phaser/systems/AnimationSystem";
import { InputSystem } from "@/phaser/systems/InputSystem";
import { ProximitySystem } from "@/phaser/systems/ProximitySystem";
import { createPlayer } from "@/phaser/entities/Player";
import type { Player } from "@/phaser/entities/Player";
import { ProximityHighlight } from "@/phaser/ui/overlays/ProximityHighlight";
import { HoverCornerHighlight } from "@/phaser/ui/overlays/HoverCornerHighlight";
import {
  TREE_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
  IRON_RECOVERY_SECONDS,
  GOLD_RECOVERY_SECONDS,
} from "@/shared/data/farming";
import { createFarmNodeRegistry } from "@/phaser/farm/types";
import type { PlotNode, ResourceNode } from "@/phaser/farm/types";
import { AnimalSystem } from "@/phaser/farm/systems/AnimalSystem";
import { FarmingSystem } from "@/phaser/farm/systems/FarmingSystem";
import { FishingSystem } from "@/phaser/farm/systems/FishingSystem";
import { ResourceSystem } from "@/phaser/farm/systems/ResourceSystem";
import { WorldInteractionSystem } from "@/phaser/farm/systems/WorldInteractionSystem";
import { WorldSystem } from "@/phaser/farm/systems/WorldSystem";
import { dispatchUiEvent, getNodeAtTile, getSkillLevel } from "@/phaser/farm/helpers";

/**
 * FarmScene — farming-only Phaser scene.
 *
 * Map model:
 *   Tiled JSON tilemap (island.json) rendered with the sunnyside tileset.
 *   60×40 tiles at 16 px → 960×640 px world.
 *   Tilelayers (bottom → top): grass, water, river, mountain, path, path2,
 *   river-path, pond-path, plots, fences, barn, trees, decor2, decor1.
 *   No object layers — entity positions come from the positions/*.ts files
 *   and the player spawn falls back to (400, 400).
 *
 * Interaction model:
 *   - WASD / mobile joystick for movement.
 *   - ProximitySystem highlights interactable objects within the 3×3 tile range.
 *   - Clicking / tapping a highlighted object triggers the interaction.
 */
export class FarmScene extends Phaser.Scene {
  // ── Instance fields ────────────────────────────────────────────────────────
  private player!: Player;
  private input_!: InputSystem;
  private proximity!: ProximitySystem;
  private proximityHighlight!: ProximityHighlight;
  private hoverHighlight!: HoverCornerHighlight;

  private playerState: Record<string, unknown> = {};
  private readonly nodes = createFarmNodeRegistry();
  private readonly _treeNodes = this.nodes.trees;
  private readonly _stoneNodes = this.nodes.stones;
  private readonly _plotNodes = this.nodes.plots;
  private readonly _buildingZones = this.nodes.buildingZones;
  private readonly _buildingNodeMap = this.nodes.buildings;
  private readonly _npcNodes = this.nodes.npcs;
  private readonly _animalNodes = this.nodes.animals;
  private readonly _fishingNodes = this.nodes.fishing;
  private worldSystem?: WorldSystem;
  private worldInteractionSystem?: WorldInteractionSystem;
  private animalSystem?: AnimalSystem;
  private farmingSystem?: FarmingSystem;
  private fishingSystem?: FishingSystem;
  private resourceSystem?: ResourceSystem;

  private _lastPointerDownMs = 0;

  // Bound event handlers for clean removal in _shutdown
  private _onPointerDown?: (pointer: Phaser.Input.Pointer) => void;
  private _onPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private _onMobileAction?: () => void;

  constructor() {
    super("FarmScene");
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  init() {
    this.playerState = this.game.registry.get("playerState") ?? {};
  }

  // ─── Preload ───────────────────────────────────────────────────────────────

  preload() {
    Loaders.loadPlayerAssets(this);
    Loaders.loadFarmAssets(this);
    Loaders.loadBuildingAssets(this);
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  create() {
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this._shutdown());

    try {
      this._createInternal();
      // Signal to the React layer that the world is fully built and rendered so
      // it can dismiss the loading screen and mount the HUD.
      window.dispatchEvent?.(new CustomEvent("phaser-farm-ready"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[FarmScene] create() threw:", msg);
      this.add
        .text(
          this.cameras.main.centerX,
          this.cameras.main.centerY,
          `Scene error:\n${msg}`,
          { fontSize: "14px", color: "#ff4444", wordWrap: { width: 700 } },
        )
        .setOrigin(0.5);
    }
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  update() {
    // Guard against InputSystem not being initialized if create() threw an error
    if (!this.input_ || !this.player) return;

    const movement = this.input_.getMovement();
    const canAnim  = (key: string) => this.anims.exists(key);

    const currentAnim   = this.player.sprite.anims?.currentAnim?.key;
    const actionAnims   = [
      "player_mine", "player_axe", "player_doing",
      "player_casting", "player_reeling", "player_caught",
    ];
    const playingAction =
      actionAnims.includes(currentAnim ?? "") && this.player.sprite.anims?.isPlaying;

    if (!playingAction) {
      if (movement.moving) {
        (this.player as unknown as Record<string, unknown>).facing = movement.facing;
        this.player.applyMovement(movement);
        if (canAnim("player_walk") && currentAnim !== "player_walk") {
          this.player.sprite.play("player_walk", true);
        }
      } else {
        (this.player.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
        if (canAnim("player_idle") && currentAnim !== "player_idle") {
          this.player.sprite.play("player_idle", true);
        }
      }
    } else {
      (this.player.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
    }

    this.animalSystem?.update();
    this.proximity.update(
      {
        trees:     this._treeNodes,
        stones:    this._stoneNodes,
        plots:     this._plotNodes,
        buildings: this._buildingNodeMap,
        npcs:      this._npcNodes,
        animals:   this.animalSystem?.getProximityNodes() ?? {},
      },
      this.proximityHighlight,
    );

    this.worldInteractionSystem?.update();
    this.fishingSystem?.update();
    this._writeMobileActionHint();
  }

  // ─── Private — setup ───────────────────────────────────────────────────────

  private _createInternal() {
    this.worldSystem = new WorldSystem(this, this.nodes);
    const world = this.worldSystem.create();
    const { width: worldW, height: worldH, spawnX, spawnY } = world;

    // ── Animations ────────────────────────────────────────────────────────
    const anims = new AnimationSystem(this);
    anims.createPlayerAnimations();
    anims.createNpcAnimations();

    this.farmingSystem = new FarmingSystem(this, {
      plots: this._plotNodes,
      playerState: () => this.playerState,
      player: () => this.player,
    });
    this.farmingSystem.create();

    this.resourceSystem = new ResourceSystem(this, {
      trees: this._treeNodes,
      stones: this._stoneNodes,
      player: () => this.player,
    });
    this.resourceSystem.create();

    // ── Player ────────────────────────────────────────────────────────────
    this.player = createPlayer(
      this,
      { x: spawnX, y: spawnY },
      { speed: GAME_CONFIG.WIDTH / 8 },
    );
    this.player.sprite.setDepth(20);

    this.worldSystem.addPlayerCollider(this.player.sprite);

    // ── Camera ────────────────────────────────────────────────────────────
    const cam = this.cameras.main;
    // Respect the player's persisted zoom preference (set in AvatarMenu Display tab).
    // Fall back to the config default if nothing is stored yet.
    const storedZoom = typeof localStorage !== "undefined"
      ? parseInt(localStorage.getItem("lf_game_zoom") ?? "", 10)
      : NaN;
    const initialZoom = (storedZoom >= 1 && storedZoom <= 4) ? storedZoom : GAME_CONFIG.ZOOM;
    cam.setZoom(initialZoom);
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player.sprite, false);
    cam.scrollX = Phaser.Math.Clamp(
      this.player.sprite.x - cam.width  / (2 * initialZoom),
      0, worldW - cam.width  / initialZoom,
    );
    cam.scrollY = Phaser.Math.Clamp(
      this.player.sprite.y - cam.height / (2 * initialZoom),
      0, worldH - cam.height / initialZoom,
    );

    // ── Systems ───────────────────────────────────────────────────────────
    this.input_ = new InputSystem(this, { speed: GAME_CONFIG.PLAYER_SPEED });
    this.proximity = new ProximitySystem(this, this.player, {
      radiusTiles: GAME_CONFIG.INTERACTION_RADIUS_TILES,
    });
    this.worldInteractionSystem = new WorldInteractionSystem(this, {
      buildingZones: this._buildingZones,
      buildings: this._buildingNodeMap,
      npcs: this._npcNodes,
      player: () => this.player,
      proximity: () => this.proximity,
    });
    this.worldInteractionSystem.create();
    this.animalSystem = new AnimalSystem(this, {
      nodes: this._animalNodes,
      player: () => this.player,
    });
    this.animalSystem.create();
    this.fishingSystem = new FishingSystem(this, {
      nodes: this._fishingNodes,
      waterLayer: world.waterLayer,
      player: () => this.player,
    });
    this.fishingSystem.create();

    // ── Physics bounds ──────────────────────────────────��─────────────────
    this.physics.world.setBounds(0, 0, worldW, worldH);
    if (this.player.sprite.body) {
      (this.player.sprite.body as Phaser.Physics.Arcade.Body)
        .setCollideWorldBounds(true);
    }

    // ── UI overlays ────────────────────────────────────────────────────────
    this.proximityHighlight = new ProximityHighlight(this);
    this.hoverHighlight = new HoverCornerHighlight(this, {
      resolveBounds: ({ tileX, tileY }) => this._getHoverBounds(tileX, tileY),
    });

    // ── Pointer interaction ────────────────────────────────────────────────
    this._setupPointerInteraction();

    window.dispatchEvent?.(
      new CustomEvent("phaser-scene-start", { detail: { sceneName: "FarmScene" } }),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._shutdown());
  }

  // ─── Pointer interaction ──────────────────────────────────────────────────

  private _setupPointerInteraction() {
    this._lastPointerDownMs = 0;

    this._onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      const now = Date.now();
      if (now - this._lastPointerDownMs < 150) return;
      this._lastPointerDownMs = now;

      const wp     = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const worldX = wp.x ?? pointer.x;
      const worldY = wp.y ?? pointer.y;
      const ts     = GAME_CONFIG.TILE_SIZE;
      const tileX  = Math.floor(worldX / ts);
      const tileY  = Math.floor(worldY / ts);

      // 1. Resource / plot node
      const node = getNodeAtTile(
        [
          ...Object.values(this._treeNodes),
          ...Object.values(this._stoneNodes),
          ...Object.values(this._plotNodes),
        ] as ResourceNode[],
        tileX, tileY,
      );

      const inRange = node ? this.proximity.isNodeInRange(node as unknown as PlotNode) : false;
      if (node && inRange) {
        if ((node as ResourceNode).type) {
          this.resourceSystem?.strike(node as ResourceNode);
        } else {
          const farmingXP = Number((window.__gameStore?.getState?.()?.state as Record<string, Record<string, number>>)?.skills?.farming ?? 0);
          const playerLevel = getSkillLevel(farmingXP);
          const reqLevel = (node as PlotNode).requiredLevel ?? 0;
          if (reqLevel > playerLevel) {
            const cam  = this.cameras.main;
            const zoom = cam.zoom;
            const cx   = node.x + GAME_CONFIG.TILE_SIZE / 2;
            const cy   = node.y;
            dispatchUiEvent("phaser-plot-locked", {
              fieldIndex:    (node as PlotNode).fieldIndex,
              requiredLevel: reqLevel,
              screenX: Math.round((cx - cam.worldView.x) * zoom + (cam.x ?? 0)),
              screenY: Math.round((cy - cam.worldView.y) * zoom + (cam.y ?? 0)),
            });
          } else {
            this.farmingSystem?.interact(node as PlotNode);
          }
        }
        dispatchUiEvent("phaser-node-interact", {
          nodeId: (node as ResourceNode).nodeId ?? (node as PlotNode).plotId,
          node,
        });
        return;
      }

      // 2. Animal
      const hitAnimal = this.animalSystem?.hitTest(worldX, worldY);
      if (hitAnimal) {
        if (this.animalSystem?.isInRange(hitAnimal)) this.animalSystem.interact(hitAnimal);
        return;
      }

      // 3. NPC
      const hitNpc = this.worldInteractionSystem?.hitNpc(worldX, worldY);
      if (hitNpc) {
        this.worldInteractionSystem?.interactNpc(hitNpc);
        return;
      }

      // 4. Building
      const hitBuilding = this.worldInteractionSystem?.hitBuilding(worldX, worldY);
      if (hitBuilding) {
        this.worldInteractionSystem?.interactBuilding(hitBuilding);
        return;
      }

      // 5. Fishing zone
      const clickTileX = Math.floor(worldX / GAME_CONFIG.TILE_SIZE);
      const clickTileY = Math.floor(worldY / GAME_CONFIG.TILE_SIZE);
      const hitFishing = Object.values(this._fishingNodes).find(
        (spot) => spot.tiles?.has(`${clickTileX},${clickTileY}`),
      );
      if (hitFishing) {
        const pTX = Math.floor(this.player.sprite.x / GAME_CONFIG.TILE_SIZE);
        const pTY = Math.floor(this.player.sprite.y / GAME_CONFIG.TILE_SIZE);
        // Adjacent = player within 2 tiles of any shore water tile
        const adjacent = (
          hitFishing.tiles?.has(`${pTX},${pTY}`)     ||
          hitFishing.tiles?.has(`${pTX - 1},${pTY}`) ||
          hitFishing.tiles?.has(`${pTX + 1},${pTY}`) ||
          hitFishing.tiles?.has(`${pTX},${pTY - 1}`) ||
          hitFishing.tiles?.has(`${pTX},${pTY + 1}`) ||
          hitFishing.tiles?.has(`${pTX - 2},${pTY}`) ||
          hitFishing.tiles?.has(`${pTX + 2},${pTY}`) ||
          hitFishing.tiles?.has(`${pTX},${pTY - 2}`) ||
          hitFishing.tiles?.has(`${pTX},${pTY + 2}`)
        );
        if (adjacent) this.fishingSystem?.cast(hitFishing);
        return;
      }
    };

    this.input.on("pointerdown", this._onPointerDown);

    // Mobile action button bridge
    this._onMobileAction = () => {
      const hint = window.__mobileActionHint;
      if (!hint) return;

      const gs       = window.__gameStore?.getState?.()?.state as Record<string, Record<string, unknown>> | undefined;
      const dispatch = window.__gameStore?.getState?.()?.dispatch;
      const TS       = GAME_CONFIG.TILE_SIZE;

      if (hint.type === "chop" || hint.type === "mine") {
        const allResource = [
          ...Object.values(this._treeNodes),
          ...Object.values(this._stoneNodes),
        ];
        const n = allResource.find((r) => !r?.isDepleted && this.proximity.isNodeInRange(r as unknown as PlotNode));
        if (n) this.resourceSystem?.strike(n);
        return;
      }

      if (hint.type === "plant" || hint.type === "harvest") {
        const farmingXP = Number((gs?.skills as Record<string, number>)?.farming ?? 0);
        const playerLevel = getSkillLevel(farmingXP);
        const n = Object.values(this._plotNodes).find((p) => {
          if (!this.proximity.isNodeInRange(p as unknown as PlotNode)) return false;
          return (p.requiredLevel ?? 0) <= playerLevel;
        });
        if (n) this.farmingSystem?.interact(n);
        return;
      }

      if (hint.type === "feed" || hint.type === "collect") {
        const node = this.animalSystem?.findNearby(hint.animal);
        if (node && dispatch) this.animalSystem?.interact(node);
        return;
      }

      if (hint.type === "fish") {
        this.fishingSystem?.cast();
        return;
      }
    };

    window.addEventListener("phaser-mobile-action", this._onMobileAction);

    this._setupPointerMoveTooltip();
  }

  // ─── Pointer-move tooltip ──────────────────────────────────────────────────

  private _setupPointerMoveTooltip() {
    const recoveryMap: Record<string, number> = {
      tree:  TREE_RECOVERY_SECONDS,
      stone: STONE_RECOVERY_SECONDS,
      iron:  IRON_RECOVERY_SECONDS,
      gold:  GOLD_RECOVERY_SECONDS,
    };

    this._onPointerMove = (pointer: Phaser.Input.Pointer) => {
      const cam    = this.cameras.main;
      const zoom   = cam.zoom;
      const wp     = cam.getWorldPoint(pointer.x, pointer.y);
      const worldX = wp.x;
      const worldY = wp.y;
      const ts     = GAME_CONFIG.TILE_SIZE;

      const toScreen = (wx: number, wy: number) => ({
        screenX: Math.round((wx - cam.worldView.x) * zoom + (cam.x ?? 0)),
        screenY: Math.round((wy - cam.worldView.y) * zoom + (cam.y ?? 0)),
      });

      const TOOLTIP_RANGE = ts * 4;
      const playerX = this.player.sprite.x;
      const playerY = this.player.sprite.y;

      // 1. Depleted resource nodes
      const allResourceNodes = [
        ...Object.values(this._treeNodes),
        ...Object.values(this._stoneNodes),
      ];
      const depletedNode = allResourceNodes.find((n) => {
        if (!n || !n.isDepleted) return false;
        const w  = n.width  ?? ts;
        const h  = n.height ?? ts;
        const cx = n.x + w / 2;
        const cy = n.y + h / 2;
        if (Math.abs(playerX - cx) > TOOLTIP_RANGE || Math.abs(playerY - cy) > TOOLTIP_RANGE) return false;
        return worldX >= n.x - 4 && worldX < n.x + w + 4 &&
               worldY >= n.y - 4 && worldY < n.y + h + 4;
      }) ?? null;

      if (depletedNode) {
        const gameState = window.__gameStore?.getState?.()?.state as Record<string, Record<string, Record<string, number>>> | undefined;
        const nodeNum   = parseInt(String(depletedNode.nodeId ?? "").replace(/\D/g, ""), 10) - 1;
        let choppedAt   = 0;
        if (gameState && !isNaN(nodeNum)) {
          if (depletedNode.type === "tree")  choppedAt = gameState.trees?.[nodeNum]?.choppedAt ?? 0;
          else if (depletedNode.type === "iron") choppedAt = gameState.iron?.[nodeNum]?.minedAt ?? 0;
          else if (depletedNode.type === "gold") choppedAt = gameState.gold?.[nodeNum]?.minedAt ?? 0;
          else choppedAt = gameState.stones?.[nodeNum]?.minedAt ?? 0;
        }
        if (!choppedAt && depletedNode.depletedAt) choppedAt = depletedNode.depletedAt;

        const { screenX, screenY } = toScreen(
          depletedNode.x + (depletedNode.width ?? ts) / 2,
          depletedNode.y,
        );
        window.__nodeTooltip = {
          kind: "depleted",
          nodeType: depletedNode.type,
          choppedAt,
          recoverySecs: recoveryMap[depletedNode.type ?? "stone"] ?? STONE_RECOVERY_SECONDS,
          screenX,
          screenY,
        };
        return;
      }

      // 2. Growing crop plot
      const hoveredPlot = Object.values(this._plotNodes).find((n) => {
        if (!n) return false;
        const w  = (n.width  ?? ts) + 8;
        const h  = (n.height ?? ts) + 8;
        const cx = n.x + w / 2;
        const cy = n.y + h / 2;
        if (Math.abs(playerX - cx) > TOOLTIP_RANGE || Math.abs(playerY - cy) > TOOLTIP_RANGE) return false;
        return worldX >= n.x - 4 && worldX < n.x + w &&
               worldY >= n.y - 4 && worldY < n.y + h;
      }) ?? null;

      if (hoveredPlot) {
        const gameState = window.__gameStore?.getState?.()?.state as Record<string, Record<string, Record<string, unknown>>> | undefined;
        const field     = gameState?.fields?.[hoveredPlot.fieldIndex] as Record<string, unknown> | undefined;
        if (field) {
          const cropName  = String(field.name ?? "").toLowerCase();
          const harvestMs = cropName ? (this.farmingSystem?.getHarvestMs(cropName) ?? 60_000) : 60000;
          const elapsed   = Date.now() - Number(field.plantedAt ?? 0);
          const isReady   = elapsed >= harvestMs;
          if (!isReady) {
            const { screenX, screenY } = toScreen(
              hoveredPlot.x + (hoveredPlot.width ?? ts) / 2,
              hoveredPlot.y,
            );
            window.__nodeTooltip = {
              kind: "growing",
              cropName: String(field.name ?? ""),
              plantedAt: Number(field.plantedAt ?? 0),
              harvestMs,
              screenX,
              screenY,
            };
            return;
          }
        }
      }

      // 3. Animal — countdown tooltip
      const animalTooltip = this.animalSystem?.getTooltip(worldX, worldY, TOOLTIP_RANGE);
      if (animalTooltip) {
        const screen = toScreen(animalTooltip.screenX, animalTooltip.screenY);
        window.__nodeTooltip = { ...animalTooltip, ...screen };
        return;
      }

      window.__nodeTooltip = null;
    };

    this.input.on("pointermove", this._onPointerMove);
  }

  // ─── Mobile action hint ────────────────────────────────────────────────────

  private _writeMobileActionHint() {
    const gs = window.__gameStore?.getState?.()?.state as Record<string, Record<string, unknown>> | undefined;
    const TS = GAME_CONFIG.TILE_SIZE;

    // 1. Resource nodes
    for (const node of Object.values(this._treeNodes)) {
      if (node?.isDepleted) continue;
      if (this.proximity.isNodeInRange(node as unknown as PlotNode)) {
        window.__mobileActionHint = { type: "chop", icon: "/assets/tools/axe.png" };
        return;
      }
    }
    for (const node of Object.values(this._stoneNodes)) {
      if (node?.isDepleted) continue;
      if (this.proximity.isNodeInRange(node as unknown as PlotNode)) {
        const icon = node.type === "gold" || node.type === "iron"
          ? "/assets/tools/iron_pickaxe.png"
          : "/assets/tools/stone_pickaxe.png";
        window.__mobileActionHint = { type: "mine", icon };
        return;
      }
    }

    // 2. Plot nodes
    for (const node of Object.values(this._plotNodes)) {
      if (!this.proximity.isNodeInRange(node as unknown as PlotNode)) continue;
      const farmingXP = Number((gs?.skills as Record<string, number>)?.farming ?? 0);
      const playerLevel = getSkillLevel(farmingXP);
      if ((node.requiredLevel ?? 0) > playerLevel) continue;

      const field    = (gs?.fields as Record<string, Record<string, unknown>>)?.[node.fieldIndex];
      const cropName = field ? String((field.name as string) ?? "").toLowerCase() : "potato";
      const harvestMs = field ? (this.farmingSystem?.getHarvestMs(cropName) ?? 60_000) : 60000;
      const isReady   = !!field && (Date.now() - Number(field.plantedAt ?? 0)) >= harvestMs;

      if (isReady) {
        window.__mobileActionHint = { type: "harvest", icon: `/assets/crops/${cropName}/crop.png`, crop: cropName };
        return;
      } else if (!field) {
        // Reflect the equipped seed on the mobile action button. If nothing is
        // equipped, fall back to a generic potato icon (tapping is gated).
        const equippedSeed = this.farmingSystem?.getEquippedSeed();
        const seedCrop     = equippedSeed ? equippedSeed.split(" ")[0].toLowerCase() : "potato";
        window.__mobileActionHint = { type: "plant", icon: `/assets/crops/${seedCrop}/seed.png`, crop: seedCrop };
        return;
      } else {
        window.__mobileActionHint = { type: "plant", icon: `/assets/crops/${cropName}/seedling.png`, crop: cropName };
        return;
      }
    }

    // 3. Animals
    const animalHint = this.animalSystem?.getMobileHint();
    if (animalHint) {
      window.__mobileActionHint = animalHint;
      return;
    }

    // 4. Fishing zone
    if (this.fishingSystem?.isNearZone()) {
      window.__mobileActionHint = { type: "fish", icon: "/assets/tools/fishing_rod.png" };
      return;
    }

    window.__mobileActionHint = null;
  }

  // ─── Hover-highlight resolver ──────────────────────────────────────────────

  private _getHoverBounds(
    tileX: number,
    tileY: number,
  ): { left: number; top: number; right: number; bottom: number } | null {
    const node = this._getInteractableNodeAtTile(tileX, tileY);
    if (!node || !this.proximity.isNodeInRange(node as unknown as PlotNode)) return null;
    const ts = GAME_CONFIG.TILE_SIZE;
    return {
      left:   node.x,
      top:    node.y,
      right:  node.x + ((node as ResourceNode).width  ?? ts),
      bottom: node.y + ((node as ResourceNode).height ?? ts),
    };
  }

  // ─── Tile helpers ─────────────────────────────────────────────────────────

  private _getInteractableNodeAtTile(tileX: number, tileY: number) {
    return getNodeAtTile(
      [
        ...Object.values(this._treeNodes),
        ...Object.values(this._stoneNodes),
        ...Object.values(this._plotNodes),
        ...Object.values(this._npcNodes) as unknown as ResourceNode[],
      ] as ResourceNode[],
      tileX, tileY,
    );
  }

  // ─── Shutdown ──────────────────────────────────────────────────────────────

  private _shutdown() {
    this.worldInteractionSystem?.destroy();
    this.worldInteractionSystem = undefined;
    this.animalSystem?.destroy();
    this.animalSystem = undefined;
    this.fishingSystem?.destroy();
    this.fishingSystem = undefined;
    this.farmingSystem?.destroy();
    this.farmingSystem = undefined;
    this.resourceSystem?.destroy();
    this.resourceSystem = undefined;
    this.worldSystem?.destroy();
    this.worldSystem = undefined;
    if (this._onPointerDown) this.input.off("pointerdown", this._onPointerDown);
    if (this._onPointerMove) this.input.off("pointermove",  this._onPointerMove);
    if (this._onMobileAction) window.removeEventListener("phaser-mobile-action", this._onMobileAction);
    window.__mobileActionHint = null;
    this.input_?.destroy();
    this.proximity?.destroy();
    this.proximityHighlight?.destroy();
    this.hoverHighlight?.destroy();
  }
}

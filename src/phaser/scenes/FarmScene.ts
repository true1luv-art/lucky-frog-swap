import Phaser from "phaser";
import { GAME_CONFIG, PLAYER_CONFIG } from "@/phaser/config/GameConfig";
import * as Loaders from "@/phaser/loaders/index";
import { AnimationSystem } from "@/phaser/systems/AnimationSystem";
import { InputSystem } from "@/phaser/systems/InputSystem";
import { ProximitySystem } from "@/phaser/systems/ProximitySystem";
import {
  animBase,
  facingFromVector,
  playDirectional,
  type Facing,
} from "@/phaser/systems/DirectionalAnimation";
import { createPlayer } from "@/phaser/entities/Player";
import type { Player } from "@/phaser/entities/Player";
import { ProximityHighlight } from "@/phaser/ui/overlays/ProximityHighlight";
import { HoverCornerHighlight } from "@/phaser/ui/overlays/HoverCornerHighlight";
import {
  TREE_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
} from "@/features/game/resources";
import { createFarmNodeRegistry } from "@/phaser/farm/types";
import type { PlotNode, ResourceNode } from "@/phaser/farm/types";
import {
  BUILDING_POSITIONS,
  NPC_POSITIONS,
  TREE_POSITIONS,
  STONE_POSITIONS,
  PLOT_POSITIONS,
  FISHING_POSITIONS,
} from "@/phaser/positions";
import { AnimalSystem } from "@/phaser/farm/systems/AnimalSystem";
import { FarmingSystem } from "@/phaser/farm/systems/FarmingSystem";
import { FishingSystem } from "@/phaser/farm/systems/FishingSystem";
import { ResourceSystem } from "@/phaser/farm/systems/ResourceSystem";
import { WorldInteractionSystem } from "@/phaser/farm/systems/WorldInteractionSystem";
import { WorldSystem } from "@/phaser/farm/systems/WorldSystem";
import { dispatchUiEvent, getNodeAtTile, getSkillLevel } from "@/phaser/farm/helpers";
import { EnemySystem } from "@/phaser/systems/EnemySystem";
import { ProjectileSystem } from "@/phaser/systems/ProjectileSystem";
import type { Enemy } from "@/phaser/entities/Enemy";
import { getBowStats, type BowTier } from "@/features/game/bow";

/**
 * FarmScene — farming-only Phaser scene.
 *
 * Map model:
 *   Tiled JSON tilemap (town.json) rendered with the sunnyside tileset.
 *   40×40 tiles at 16 px → 640×640 px world (square portrait map).
 *   Tilelayers (bottom → top): grass, path_1, path_2, trees, decor_1.
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
  private enemySystem?: EnemySystem;
  private projectileSystem?: ProjectileSystem;
  private _lastShotAt = 0;
  private _invulnUntilMs = 0;
  private _respawning = false;
  private _spawnPoint = { x: 400, y: 400 };

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

    // Dispatch scene-start NOW so React can paint the loader overlay.
    // Then defer _createInternal by two rAF ticks so the browser actually
    // renders the loading screen before the synchronous world-build begins.
    window.dispatchEvent?.(new CustomEvent("phaser-scene-start", { detail: { sceneName: "FarmScene" } }));

    // Defer two rAF frames so the browser paints the loader before world-build.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        this._createInternal();
        // Signal to the React layer that the world is fully built — hides the loader.
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
    }));
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  override update() {
    // Guard against InputSystem not being initialized if create() threw an error,
    // or update() firing before _createInternal() runs (deferred rAF).
    if (!this.input_ || !this.player || !this.player.sprite?.anims) return;

    // Y-sort: player depth tracks its world-Y so it renders behind objects
    // whose feet are higher on screen and in front of objects below it.
    this.player.sprite.setDepth(this.player.sprite.y);

    const movement = this.input_.getMovement();

    const currentAnim   = this.player.sprite.anims?.currentAnim?.key;
    const currentBase   = animBase(currentAnim);
    const actionAnims   = [
      "player_mine", "player_axe", "player_doing", "player_shovel", "player_hammer",
      "player_casting", "player_reeling", "player_caught", "player_bow", "player_damage",
      "player_watering",
      "player_death",
    ];
    const playingAction =
      actionAnims.includes(currentBase) && this.player.sprite.anims?.isPlaying;

    if (!playingAction) {
      const facing = (this.player.facing ?? "down") as Facing;
      if (movement.moving) {
        this.player.applyMovement(movement);
        playDirectional(this.player.sprite, "player_walk", movement.facing as Facing);
      } else {
        (this.player.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
        playDirectional(this.player.sprite, "player_idle", facing);
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
    this._updateCombat();
    this._checkTravelBoundaries();
    this._writeMobileActionHint();
  }

  // ─── Combat ────────────────────────────────────────────────────────────────

  private _updateCombat() {
    if (!this.enemySystem || !this.projectileSystem) return;

    this.enemySystem.update(this.player.sprite);
    this.projectileSystem.update();
    this._resolveArrowHits();


    const wantsAttack = this.input_.consumeAttack();
    if (!wantsAttack || this._respawning) return;
    // The bow must be equipped before it can be aimed or fired.
    if (!this._isBowEquipped()) return;

    const stats = getBowStats(this._readBowTier());
    const now = this.time.now;
    if (now - this._lastShotAt < stats.fireRateMs) return;
    this._lastShotAt = now;

    // Fire from the character's centre (where the bow is drawn), pushed a
    // little forward along the actual aim direction so the arrow leaves the
    // bow instead of the feet or a corner.
    let facing = this.player.facing;
    const bx = this.player.sprite.x;
    const by = this.player.sprite.y;
    // Aim along the mouse cursor when we have one; fall back to facing.
    const aim = this.input_.aim;
    const angle = aim
      ? Phaser.Math.Angle.Between(bx, by, aim.x, aim.y)
      : undefined;

    if (aim) {
      // Face the shot so the animation reads correctly.
      facing = facingFromVector(aim.x - bx, aim.y - by);
      this.player.facing = facing;
    }

    const nudge = 10;
    const dir =
      angle !== undefined
        ? { x: Math.cos(angle), y: Math.sin(angle) }
        : {
            up:    { x: 0,  y: -1 },
            down:  { x: 0,  y: 1  },
            left:  { x: -1, y: 0  },
            right: { x: 1,  y: 0  },
          }[facing];

    this.projectileSystem.fire(bx + dir.x * nudge, by + dir.y * nudge, facing, stats, angle);
    playDirectional(this.player.sprite, "player_bow", facing as Facing, false);
  }

  /** The bow is a normal inventory tool: it is "equipped" when it is the
   *  currently selected hotbar item. */
  private _isBowEquipped(): boolean {
    return (window as unknown as { __selectedItem?: string }).__selectedItem === "Bow";
  }

  /**
   * Arrow → enemy hit detection.
   *
   * Enemy physics bodies are tiny feet boxes (they mirror the player's), which
   * makes arcade overlap far too easy to slip past. A distance check against the
   * enemy body centre with a generous radius feels much closer to Archero.
   */
  private _resolveArrowHits() {
    if (!this.enemySystem || !this.projectileSystem) return;
    const HIT_RADIUS = 18;

    for (const arrow of [...this.projectileSystem.arrows]) {
      if (!arrow.sprite.active) continue;
      for (const enemy of this.enemySystem.getEnemies()) {
        if (enemy.dying || enemy.isDead()) continue;
        const dist = Phaser.Math.Distance.Between(
          arrow.sprite.x, arrow.sprite.y, enemy.bodyX, enemy.bodyY,
        );
        if (dist > HIT_RADIUS) continue;

        enemy.takeDamage(arrow.damage);
        // Getting shot provokes the enemy: it hunts the player for a while
        // even if the arrow came from outside its normal spot range.
        enemy.provokedUntil = Date.now() + 8000;
        this.projectileSystem.kill(arrow);
        this._floatText(enemy.bodyX, enemy.bodyY - 26, `-${arrow.damage}`, "#ff6b6b");

        enemy.sprite.setTintFill(0xffffff);
        this.time.delayedCall(70, () => {
          if (enemy.sprite?.active) enemy.sprite.setTint(enemy.config.spriteTint);
        });

        if (enemy.isDead()) this.enemySystem.handleDeath(enemy);
        break;
      }
    }
  }

  private _readBowTier(): BowTier {
    const gs = window.__gameStore?.getState?.()?.state as Record<string, unknown> | undefined;
    return (gs?.bowTier as BowTier) ?? "Wood";
  }

  private _hurtPlayer(damage: number) {
    if (this._respawning) return;
    const now = this.time.now;
    if (now < this._invulnUntilMs) return;
    this._invulnUntilMs = now + 400;

    const store = window.__gameStore?.getState?.();
    store?.dispatch?.({ type: "player.hurt", damage });

    this._floatText(this.player.sprite.x, this.player.sprite.y - 20, `-${damage}`, "#ff9494");
    playDirectional(
      this.player.sprite,
      "player_damage",
      (this.player.facing ?? "down") as Facing,
      false,
    );
    this.player.sprite.setTintFill(0xff4444);
    this.time.delayedCall(90, () => this.player.sprite?.clearTint());
    this.cameras.main.shake(90, 0.004);

    const hp = Number((store?.state as Record<string, unknown> | undefined)?.hp ?? 100);
    if (hp - damage <= 0) this._respawnPlayer();
  }

  private _rewardKill(enemy: Enemy) {
    window.__gameStore?.getState?.()?.dispatch?.({
      type: "enemy.defeated",
      enemyId: enemy.id,
      enemyType: enemy.type,
    });
    this._floatText(enemy.bodyX, enemy.bodyY - 34, `+${enemy.config.goldDrop}g`, "#ffd75e");
  }

  private _respawnPlayer() {
    if (this._respawning) return;
    this._respawning = true;

    // Stop movement and play the death strip before respawning.
    (this.player.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
    playDirectional(
      this.player.sprite,
      "player_death",
      (this.player.facing ?? "down") as Facing,
      false,
    );

    const cam = this.cameras.main;
    // death_strip14 @ 14 fps = ~1000 ms; let it finish before the fade.
    this.time.delayedCall(1000, () => {
      cam.fade(220, 0, 0, 0);
      this.time.delayedCall(260, () => {
        this.player.sprite.setPosition(this._spawnPoint.x, this._spawnPoint.y);
        (this.player.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
        this.enemySystem?.resetAll();
        window.__gameStore?.getState?.()?.dispatch?.({ type: "player.died" });
        dispatchUiEvent("phaser-player-died", {});
        cam.fadeIn(220, 0, 0, 0);
        this._invulnUntilMs = this.time.now + 2000;
        this._respawning = false;
      });
    });
  }

  /** Small floating combat number rendered in-world. */
  private _floatText(x: number, y: number, text: string, color: string) {
    const label = this.add.text(x, y, text, {
      fontFamily: "monospace",
      fontSize: "8px",
      color,
      stroke: "#1c1116",
      strokeThickness: 2,
    })
      .setOrigin(0.5)
      .setDepth(100000);

    this.tweens.add({
      targets: label,
      y: y - 12,
      alpha: 0,
      duration: 600,
      onComplete: () => label.destroy(),
    });
  }

  /**
   * boundary_to_town / boundary_to_beach are placement-only marker layers —
   * the destination maps do not exist yet, so stepping on one shows the
   * "coming soon" area modal instead of changing scene.
   */
  private _lastTravelPromptMs = 0;
  private _checkTravelBoundaries(): void {
    const world = this.worldSystem;
    if (!world || !this.player?.sprite) return;
    const now = this.time.now;
    if (now - this._lastTravelPromptMs < 4000) return;

    const x = this.player.sprite.x;
    const y = this.player.sprite.y;
    const areas: Array<[string, string]> = [
      ["boundary_to_town",  "Hearthvale Town"],
      ["boundary_to_beach", "Beach"],
    ];
    for (const [layer, label] of areas) {
      if (world.hasTileAt(layer, x, y)) {
        this._lastTravelPromptMs = now;
        dispatchUiEvent("phaser-coming-soon", { area: label });
        return;
      }
    }
  }

  // ─── Private — setup ──────────�����──────────────���─────────────────────────────

  private _createInternal() {
    this.worldSystem = new WorldSystem(this, this.nodes, {
      mapKey: "farm",
      positions: {
        buildings: BUILDING_POSITIONS,
        trees:     TREE_POSITIONS,
        stones:    STONE_POSITIONS,
        plots:     PLOT_POSITIONS,
        fishing:   FISHING_POSITIONS,
        npcs:      NPC_POSITIONS,
      },
    });
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
      onNodeDepleted: (node) => this.worldSystem?.removeResourceCollider(node),
      onNodeRestored:  (node) => this.worldSystem?.addResourceCollider(node),
    });
    this.resourceSystem.create();

    // ── Player ────────────────────────────────────────────────────────────
    this.player = createPlayer(
      this,
      { x: spawnX, y: spawnY },
      { speed: GAME_CONFIG.WIDTH / 8 },
    );
    // Initial depth — overwritten every frame by the Y-sort in update().
    this.player.sprite.setDepth(spawnY);

    this.worldSystem.addPlayerCollider(this.player.sprite);
    this.worldSystem.addResourceColliders(this._treeNodes, this._stoneNodes, this.player.sprite);

    // ── Camera ────────────────────────────────────────────────────────────
    const cam = this.cameras.main;
    // Respect the player's persisted zoom preference (set in AvatarMenu Display tab).
    // Fall back to the config default if nothing is stored yet.
    const storedZoom = typeof localStorage !== "undefined"
      ? parseFloat(localStorage.getItem("lf_game_zoom") ?? "")
      : NaN;
    const preferredZoom = (storedZoom >= 2.5 && storedZoom <= 4) ? storedZoom : GAME_CONFIG.ZOOM;

    // Compute minimum zoom needed so the world fills the canvas in both axes,
    // preventing the background colour from bleeding through at the edges.
    const minZoom = Math.max(
      cam.width  / worldW,
      cam.height / worldH,
    );
    const initialZoom = Math.max(preferredZoom, minZoom);

    cam.setZoom(initialZoom);

    // The sprite sheet is 96×64 with origin (0.5,0.5), but the physics body
    // is a 10×10 hitbox offset (43, 27) from the sprite top-left.
    // Body centre in world space = sprite.x + (43 + 5) - 48 = sprite.x - 0
    // i.e. body centre ≈ sprite centre in x but the visible art extends
    // 48px left of sprite.x.  We pad the camera world bounds by the sprite
    // half-width (48px) so the camera never stops before the art is fully on
    // screen, and we use setFollowOffset to track the body centre exactly.
    const spriteHalfW = GAME_CONFIG.SPRITE_WIDTH  / 2; // 48
    const spriteHalfH = GAME_CONFIG.SPRITE_HEIGHT / 2; // 32
    // Inset the bounds so scrollX/Y can never reveal the BG colour.
    cam.setBounds(0, 0, worldW, worldH);
    // Follow offset: nudge the tracked point to the physics body centre.
    // body offset (43,27) + half body (5,5) - half sprite (48,32) = (0,-0)
    // Effectively zero here, but written explicitly for future tuning.
    const followOffsetX = (PLAYER_CONFIG.BODY_OFFSET.x + PLAYER_CONFIG.BODY_SIZE.width  / 2) - spriteHalfW;
    const followOffsetY = (PLAYER_CONFIG.BODY_OFFSET.y + PLAYER_CONFIG.BODY_SIZE.height / 2) - spriteHalfH;
    // roundPixels=false — with fractional zoom levels (2.5, 3.5) rounding the
    // camera scroll to whole pixels every frame fights the physics position and
    // causes a visible 1px jitter. Subpixel rendering is acceptable at these
    // zoom levels; the tilemap renderer handles its own pixel snapping.
    // lerpX/lerpY = 1 means instant follow (no lag) — the camera always centres
    // on the player unless clamped by the world bounds.
    cam.startFollow(this.player.sprite, false, 1, 1, followOffsetX, followOffsetY);
    // Snap scroll to the player's starting position immediately.
    cam.scrollX = Phaser.Math.Clamp(
      this.player.sprite.x - (cam.width  / initialZoom) / 2,
      0, Math.max(0, worldW - cam.width  / initialZoom),
    );
    cam.scrollY = Phaser.Math.Clamp(
      this.player.sprite.y - (cam.height / initialZoom) / 2,
      0, Math.max(0, worldH - cam.height / initialZoom),
    );

    // Re-apply minZoom whenever the browser resizes so the world always fills
    // the canvas regardless of window size or device orientation.
    this.scale.on(Phaser.Scale.Events.RESIZE, (_gw: number, _gh: number, _w: number, _h: number) => {
      const newMin = Math.max(
        cam.width  / worldW,
        cam.height / worldH,
      );
      if (cam.zoom < newMin) cam.setZoom(newMin);
    });

    // ── Systems ───────────────────────────────────────────────────────────
    this.input_ = new InputSystem(this, { speed: GAME_CONFIG.PLAYER_SPEED });
    this.proximity = new ProximitySystem(this, this.player, {
      radiusTiles: GAME_CONFIG.INTERACTION_RADIUS_TILES,
    });
    this.worldInteractionSystem = new WorldInteractionSystem(this, {
      buildingZones: this._buildingZones,
      buildings:     this._buildingNodeMap,
      npcs:          this._npcNodes,
      npcPositions:  NPC_POSITIONS,
      player:        () => this.player,
      proximity:     () => this.proximity,
    });
    this.worldInteractionSystem.create();
    this.animalSystem = new AnimalSystem(this, {
      nodes: this._animalNodes,
      player: () => this.player,
    });
    this.animalSystem.create();
    this.fishingSystem = new FishingSystem(this, {
      nodes: this._fishingNodes,
      fishingLayer: world.fishingLayer,
      player: () => this.player,
    });
    this.fishingSystem.create();

    // ── Combat ────────────────────────────────────────────────────────────
    this._spawnPoint = { x: spawnX, y: spawnY };
    this.projectileSystem = new ProjectileSystem(this);
    this.enemySystem = new EnemySystem(this, {
      onPlayerHit: (damage) => this._hurtPlayer(damage),
      onEnemyKilled: (enemy) => this._rewardKill(enemy),
      isTileBlocked: (tileX, tileY) => this.worldSystem?.isTileBlocked(tileX, tileY) ?? false,
    });
    this.enemySystem.create();


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

    // ── Pointer interaction ───�����─────────────���������──────────────────────────────
    this._setupPointerInteraction();

    // Debug handle so tooling can inspect live scene state.
    (window as unknown as Record<string, unknown>).__farmScene = this;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._shutdown());
  }

  /** Debug/verification helpers. */
  getCombatDebug() {
    return {
      enemies: this.enemySystem?.getEnemies().map((e) => ({
        id: e.id, type: e.type, hp: e.hp, state: e.state,
        x: Math.round(e.sprite.x), y: Math.round(e.sprite.y),
      })) ?? [],
      arrows: this.projectileSystem?.arrows.length ?? 0,
      player: { x: Math.round(this.player.sprite.x), y: Math.round(this.player.sprite.y), facing: this.player.facing },
    };
  }

  /** Teleports the player — debug only. */
  debugTeleport(tileX: number, tileY: number) {
    const ts = GAME_CONFIG.TILE_SIZE;
    this.player.sprite.setPosition(tileX * ts + ts / 2, tileY * ts + ts / 2);
  }

  // ���─��� Pointer interaction ───────────────────────────────────────────���──────

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
    // All stone positions share the same recovery time — ore type is determined
    // by the pickaxe tier loot roll, not the node itself.
    const recoveryMap: Record<string, number> = {
      tree:  TREE_RECOVERY_SECONDS,
      stone: STONE_RECOVERY_SECONDS,
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
          if (depletedNode.type === "tree") choppedAt = gameState.trees?.[nodeNum]?.choppedAt ?? 0;
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
          const isWatered = Boolean(field.isWatered ?? false);
          const wateredAt = Number(field.wateredAt ?? 0);
          const readyAt   = wateredAt + harvestMs;
          const now       = Date.now();

          const { screenX, screenY } = toScreen(
            hoveredPlot.x + (hoveredPlot.width ?? ts) / 2,
            hoveredPlot.y,
          );

          if (!isWatered) {
            // Planted but not watered yet — use the explicit isWatered flag.
            window.__nodeTooltip = {
              kind: "needs_water",
              cropName: String(field.name ?? ""),
              screenX,
              screenY,
            };
            return;
          }

          if (isWatered && now < readyAt) {
            // Watered and growing — countdown from wateredAt using growthMs.
            window.__nodeTooltip = {
              kind: "growing",
              cropName: String(field.name ?? ""),
              plantedAt: wateredAt,
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
        window.__mobileActionHint = { type: "chop", icon: "/assets/tools/wood_axe.png" };
        return;
      }
    }
    for (const node of Object.values(this._stoneNodes)) {
      if (node?.isDepleted) continue;
      if (this.proximity.isNodeInRange(node as unknown as PlotNode)) {
        window.__mobileActionHint = { type: "mine", icon: "/assets/tools/wood_pickaxe.png" };
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
      window.__mobileActionHint = { type: "fish", icon: "/assets/tools/wood_rod.png" };
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

  // ─── Tile helpers ��────────────────────────────────────────────────────────

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

  // ─── Shutdown ─────────────────────────────────────────���────────────────────

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
    this.enemySystem?.destroy();
    this.enemySystem = undefined;
    this.projectileSystem?.destroy();
    this.projectileSystem = undefined;
    this.worldSystem?.destroy();
    this.worldSystem = undefined;
    if (this._onPointerDown)  this.input.off("pointerdown", this._onPointerDown);
    if (this._onPointerMove)  this.input.off("pointermove",  this._onPointerMove);
    if (this._onMobileAction) window.removeEventListener("phaser-mobile-action",  this._onMobileAction);
    window.__mobileActionHint = null;
    this.input_?.destroy();
    this.proximity?.destroy();
    this.proximityHighlight?.destroy();
    this.hoverHighlight?.destroy();
  }
}

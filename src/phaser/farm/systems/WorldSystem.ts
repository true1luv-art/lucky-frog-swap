import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import { getPlotFarmLevelRequirement } from "@/features/game/farm-level";
import type { ResourceNode } from "@/phaser/farm/types";
import type { FarmNodeRegistry } from "@/phaser/farm/types";
import type { BuildingZoneDef } from "@/phaser/positions/buildingPositions";
import type { NpcPositionDef } from "@/phaser/positions/npcPositions";
import type { PlotPositionDef } from "@/phaser/positions/plotPositions";
import type { ResourcePositionDef } from "@/phaser/positions/treePositions";
import type { FishingZoneDef } from "@/phaser/positions/fishingPositions";

export interface FarmWorld {
  map: Phaser.Tilemaps.Tilemap;
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
  /** The fishing_boundary layer — tiles here are valid cast targets. */
  fishingLayer: Phaser.Tilemaps.TilemapLayer | null;
}

export interface WorldSystemOptions {
  /** Phaser tilemap cache key. Defaults to "town". */
  mapKey?: string;
  /** Scene-specific position overrides. If omitted, nothing is spawned. */
  positions?: {
    buildings?: BuildingZoneDef[];
    npcs?:      NpcPositionDef[];
    plots?:     PlotPositionDef[];
    trees?:     ResourcePositionDef[];
    stones?:    ResourcePositionDef[];
    fishing?:   FishingZoneDef[];
  };
}

export class WorldSystem {
  private colliders?: Phaser.Physics.Arcade.StaticGroup;
  private resourceColliders?: Phaser.Physics.Arcade.StaticGroup;
  private resourceColliderPlayer?: Phaser.GameObjects.GameObject;
  private readonly mapKey: string;
  private readonly positions: Required<NonNullable<WorldSystemOptions["positions"]>>;
  /** Named invisible layers keyed by layer name (e.g. "boundary_to_farm"). */
  private namedLayers: Record<string, Phaser.Tilemaps.TilemapLayer> = {};

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly nodes: FarmNodeRegistry,
    options: WorldSystemOptions = {},
  ) {
    this.mapKey = options.mapKey ?? "town";
    this.positions = {
      buildings: options.positions?.buildings ?? [],
      npcs:      options.positions?.npcs      ?? [],
      plots:     options.positions?.plots     ?? [],
      trees:     options.positions?.trees     ?? [],
      stones:    options.positions?.stones    ?? [],
      fishing:   options.positions?.fishing   ?? [],
    };
  }

  create(): FarmWorld {
    const map = this.scene.make.tilemap({ key: this.mapKey });
    const tileset = map.addTilesetImage("spr_tileset_sunnysideworld_16px", "tiles");
    if (!tileset) {
      throw new Error('Tileset "spr_tileset_sunnysideworld_16px" not found. Check town.json.');
    }

    const { fishingLayer, boundaryLayer } = this.buildLayers(map, tileset);
    const { spawnX, spawnY } = this.readPositions(map);
    this.createBuildingColliders(boundaryLayer);

    return {
      map,
      width: map.widthInPixels,
      height: map.heightInPixels,
      spawnX,
      spawnY,
      fishingLayer,
    };
  }

  addPlayerCollider(player: Phaser.GameObjects.GameObject): void {
    if (this.colliders)         this.scene.physics.add.collider(player, this.colliders);
    if (this.boundaryLayer)     this.scene.physics.add.collider(player, this.boundaryLayer);
    if (this.barnBoundaryLayer) this.scene.physics.add.collider(player, this.barnBoundaryLayer);
    // Resource colliders registered after addResourceColliders() is called.
    if (this.resourceColliders) this.scene.physics.add.collider(player, this.resourceColliders);
    this.resourceColliderPlayer = player;
  }

  /**
   * Creates a static physics body for every non-depleted resource node (trees + stones).
   * Call this AFTER ResourceSystem.create() so node.isDepleted is already seeded.
   * Also registers the collider with the player if addPlayerCollider was already called.
   */
  addResourceColliders(
    trees:  Record<string, ResourceNode>,
    stones: Record<string, ResourceNode>,
    player: Phaser.GameObjects.GameObject,
  ): void {
    this.resourceColliders = this.scene.physics.add.staticGroup();

    const allNodes = [...Object.values(trees), ...Object.values(stones)];
    for (const node of allNodes) {
      if (node.isDepleted) continue;
      this._addNodeCollider(node);
    }

    this.scene.physics.add.collider(player, this.resourceColliders);
    this.resourceColliderPlayer = player;
  }

  /**
   * Adds a static physics body for a single node (called when it respawns).
   * No-op if resource colliders haven't been initialised yet.
   */
  addResourceCollider(node: ResourceNode): void {
    if (!this.resourceColliders) return;
    if (node.physicsBody) return; // already has one
    this._addNodeCollider(node);
    this.resourceColliders.refresh();
  }

  /**
   * Removes the static physics body for a single node (called when it is depleted).
   */
  removeResourceCollider(node: ResourceNode): void {
    if (!node.physicsBody) return;
    try {
      this.resourceColliders?.remove(node.physicsBody, true, true);
    } catch { /* already destroyed */ }
    node.physicsBody = undefined;
  }

  private _addNodeCollider(node: ResourceNode): void {
    const ts = GAME_CONFIG.TILE_SIZE;
    // Hitbox: bottom half of a 2×2 tile node — tight foot-level blocker.
    // Node origin is top-left corner; centre the hitbox at (x + ts, y + ts*1.5).
    const bodyW = ts;
    const bodyH = ts * 0.75;
    const bodyX = node.x + ts;            // horizontal centre of the 2×2 tile node
    const bodyY = node.y + ts * 1.5;      // lower half — feet-level collision

    const rect = this.scene.add.rectangle(bodyX, bodyY, bodyW, bodyH)
      .setVisible(false)
      .setDepth(0);
    this.scene.physics.add.existing(rect, true);
    this.resourceColliders!.add(rect);
    node.physicsBody = rect;
  }

  /**
   * Returns true if the world-pixel position (worldX, worldY) sits on a
   * non-empty tile in the named layer. Used for scene-transition boundaries.
   */
  hasTileAt(layerName: string, worldX: number, worldY: number): boolean {
    const layer = this.namedLayers[layerName];
    if (!layer) return false;
    const tile = layer.getTileAtWorldXY(worldX, worldY);
    return tile !== null && tile.index > 0;
  }

  private boundaryLayer:     Phaser.Tilemaps.TilemapLayer | null = null;
  private barnBoundaryLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  private buildLayers(map: Phaser.Tilemaps.Tilemap, tileset: Phaser.Tilemaps.Tileset): {
    fishingLayer: Phaser.Tilemaps.TilemapLayer | null;
    boundaryLayer: Phaser.Tilemaps.TilemapLayer | null;
  } {
    const make = (name: string, depth: number) =>
      map.createLayer(name, tileset, 0, 0)?.setDepth(depth) ?? null;

    // Farm render layers — bottom → top, matching farm.json layer order:
    // ground, dirt, trees, path_1, path_2, plots, pond, fence,
    // decoration_1, decoration_2
    make("ground",       0);
    make("dirt",         1);
    make("trees",        2);
    make("path_1",       3);
    make("path_2",       4);
    make("plots",        5);
    make("pond",         6);
    make("fence",        7);
    make("decoration_1", 8);
    make("decoration_2", 9);

    // Boundary layer — invisible, used for player collision only
    const boundaryLayer = map.createLayer("boundary", tileset, 0, 0)?.setDepth(0)?.setVisible(false) ?? null;
    if (boundaryLayer) {
      boundaryLayer.setCollisionByExclusion([-1, 0]);
      this.boundaryLayer = boundaryLayer;
    }

    // boundary_ranch is the animal enclosure zone — NOT a player collision wall.
    // We still create the layer so hasTileAt() queries work, but no collider.
    const barnBoundary = map.createLayer("boundary_ranch", tileset, 0, 0)?.setDepth(0)?.setVisible(false);
    this.barnBoundaryLayer = barnBoundary ?? null;
    if (barnBoundary) this.namedLayers["boundary_ranch"] = barnBoundary;

    // Pond boundary layer — invisible, defines castable fishing tiles.
    const fishingLayer = map.createLayer("boundary_pond", tileset, 0, 0)?.setDepth(0)?.setVisible(false) ?? null;
    if (fishingLayer) this.namedLayers["boundary_pond"] = fishingLayer;

    // Travel boundaries — invisible marker tiles only (destination maps not built yet).
    for (const name of ["boundary_to_town", "boundary_to_beach"]) {
      const layer = map.createLayer(name, tileset, 0, 0)?.setDepth(0)?.setVisible(false);
      if (layer) this.namedLayers[name] = layer;
    }


    return { fishingLayer, boundaryLayer };
  }

  private readPositions(map: Phaser.Tilemaps.Tilemap) {
    const size = GAME_CONFIG.TILE_SIZE;
    const spawn = map.getObjectLayer("player_spawns")?.objects?.[0];
    const spawnX = typeof spawn?.x === "number" && Number.isFinite(spawn.x) ? spawn.x : 400;
    const spawnY = typeof spawn?.y === "number" && Number.isFinite(spawn.y) ? spawn.y : 400;

    for (const plot of this.positions.plots) {
      this.nodes.plots[plot.id] = {
        plotId: plot.id, fieldIndex: plot.fieldIndex, x: plot.x * size, y: plot.y * size,
        width: size, height: size, isDepleted: false,
        requiredLevel: getPlotFarmLevelRequirement(plot.fieldIndex),
      };
    }
    for (const tree of this.positions.trees) {
      this.nodes.trees[tree.id] = { nodeId: tree.id, type: "tree", x: tree.x * size, y: tree.y * size, width: size * 2, height: size * 2, isDepleted: false };
    }
    for (const stone of this.positions.stones) {
      this.nodes.stones[stone.id] = { nodeId: stone.id, type: "stone", x: stone.x * size, y: stone.y * size, width: size * 2, height: size * 2, isDepleted: false };
    }
    for (const building of this.positions.buildings) {
      this.nodes.buildingZones.push({ type: building.type, x: building.x * size, y: building.y * size, width: building.width * size, height: building.height * size });
    }
    for (const fishing of this.positions.fishing) {
      this.nodes.fishing[fishing.id] = { id: fishing.id, depth: fishing.depth, event: fishing.event, tiles: null };
    }
    // NPCs are spawned by WorldInteractionSystem using nodes.npcs; we seed
    // the registry here with placeholder entries that WorldInteractionSystem
    // will fill with actual sprites when it creates them.
    for (const npc of this.positions.npcs) {
      // Only seed if not already present (WorldInteractionSystem may populate)
      if (!this.nodes.npcs[npc.id]) {
        (this.nodes.npcs as Record<string, unknown>)[npc.id] = {
          id: npc.id, x: npc.x * size, y: npc.y * size,
          width: npc.width * size, height: npc.height * size,
          texture: npc.texture ?? "npc_questkeeper",
          event:   npc.event   ?? "",
          sprite:  null,
        };
      }
    }
    return { spawnX, spawnY };
  }

  // boundaryLayer param kept for potential future use (tile-based per-zone collisions).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createBuildingColliders(_boundaryLayer: Phaser.Tilemaps.TilemapLayer | null): void {
    this.colliders = this.scene.physics.add.staticGroup();
    for (const zone of this.nodes.buildingZones) {
      const body = this.scene.add.rectangle(zone.x + zone.width / 2, zone.y + zone.height / 2, zone.width, zone.height);
      this.scene.physics.add.existing(body, true);
      this.colliders.add(body);
    }
  }

  destroy(): void {
    if (this.colliders) {
      try { this.colliders.clear(true, true); } catch { /* already destroyed by Phaser */ }
      this.colliders = undefined;
    }
    if (this.resourceColliders) {
      try { this.resourceColliders.clear(true, true); } catch { /* already destroyed by Phaser */ }
      this.resourceColliders = undefined;
    }
    this.resourceColliderPlayer = undefined;
    this.boundaryLayer = null;
    this.barnBoundaryLayer = null;
    this.namedLayers = {};
  }
}

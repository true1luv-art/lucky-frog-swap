import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import {
  BUILDING_POSITIONS,
  FISHING_POSITIONS,
  GOLD_POSITIONS,
  IRON_POSITIONS,
  PLOT_POSITIONS,
  STONE_POSITIONS,
  TREE_POSITIONS,
} from "@/phaser/positions";
import { FIELD_LEVEL_REQUIREMENTS } from "@/shared/game/experience";
import type { FarmNodeRegistry } from "@/phaser/farm/types";

export interface FarmWorld {
  map: Phaser.Tilemaps.Tilemap;
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
  waterLayer: Phaser.Tilemaps.TilemapLayer | null;
}

export class WorldSystem {
  private colliders?: Phaser.Physics.Arcade.StaticGroup;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly nodes: FarmNodeRegistry,
  ) {}

  create(): FarmWorld {
    const map = this.scene.make.tilemap({ key: "island" });
    const tileset = map.addTilesetImage("spr_tileset_sunnysideworld_16px", "tiles");
    if (!tileset) {
      throw new Error('Tileset "spr_tileset_sunnysideworld_16px" not found. Check island.json.');
    }

    const waterLayer = this.buildLayers(map, tileset);
    const { spawnX, spawnY } = this.readPositions(map);
    this.createBuildingColliders();

    return {
      map,
      width: map.widthInPixels,
      height: map.heightInPixels,
      spawnX,
      spawnY,
      waterLayer,
    };
  }

  addPlayerCollider(player: Phaser.GameObjects.GameObject): void {
    if (this.colliders) this.scene.physics.add.collider(player, this.colliders);
  }

  private buildLayers(map: Phaser.Tilemaps.Tilemap, tileset: Phaser.Tilemaps.Tileset) {
    const make = (name: string, depth: number) => map.createLayer(name, tileset, 0, 0)?.setDepth(depth) ?? null;
    make("grass", 0);
    const waterLayer = make("river", 1);
    make("water", 1);
    make("mountain", 2);
    make("path", 3);
    make("path2", 3);
    make("river-path", 4);
    make("pond-path", 4);
    make("plots", 5);
    make("fences", 6);
    make("barn", 7);
    make("trees", 9);
    make("decor2", 10);
    make("decor1", 11);
    return waterLayer;
  }

  private readPositions(map: Phaser.Tilemaps.Tilemap) {
    const size = GAME_CONFIG.TILE_SIZE;
    const spawn = map.getObjectLayer("player")?.objects?.[0];
    const spawnX = typeof spawn?.x === "number" && Number.isFinite(spawn.x) ? spawn.x : 400;
    const spawnY = typeof spawn?.y === "number" && Number.isFinite(spawn.y) ? spawn.y : 400;

    for (const plot of PLOT_POSITIONS) {
      this.nodes.plots[plot.id] = {
        plotId: plot.id, fieldIndex: plot.fieldIndex, x: plot.x * size, y: plot.y * size,
        width: size, height: size, isDepleted: false,
        requiredLevel: FIELD_LEVEL_REQUIREMENTS[plot.fieldIndex] ?? 0,
      };
    }
    for (const tree of TREE_POSITIONS) {
      this.nodes.trees[tree.id] = { nodeId: tree.id, x: tree.x * size, y: tree.y * size, width: size * 2, height: size * 2, isDepleted: false };
    }
    for (const stone of [...STONE_POSITIONS, ...IRON_POSITIONS, ...GOLD_POSITIONS]) {
      this.nodes.stones[stone.id] = { nodeId: stone.id, x: stone.x * size, y: stone.y * size, width: size * 2, height: size * 2, isDepleted: false };
    }
    for (const building of BUILDING_POSITIONS) {
      this.nodes.buildingZones.push({ type: building.type, x: building.x * size, y: building.y * size, width: building.width * size, height: building.height * size });
    }
    for (const fishing of FISHING_POSITIONS) {
      this.nodes.fishing[fishing.id] = { id: fishing.id, depth: fishing.depth, event: fishing.event, tiles: null };
    }
    return { spawnX, spawnY };
  }

  private createBuildingColliders(): void {
    this.colliders = this.scene.physics.add.staticGroup();
    for (const zone of this.nodes.buildingZones) {
      const body = this.scene.add.rectangle(zone.x + zone.width / 2, zone.y + zone.height / 2, zone.width, zone.height);
      this.scene.physics.add.existing(body, true);
      this.colliders.add(body);
    }
  }

  destroy(): void {
    this.colliders?.clear(true, true);
    this.colliders = undefined;
  }
}

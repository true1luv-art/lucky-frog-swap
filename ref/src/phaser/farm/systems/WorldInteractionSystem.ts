import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { Player } from "@/phaser/entities/Player";
import { dispatchUiEvent, isBuildingInRange } from "@/phaser/farm/helpers";
import type { BuildingZoneNode, NpcNode, PlotNode } from "@/phaser/farm/types";
import type { NpcPositionDef } from "@/phaser/positions/npcPositions";
import type { ProximitySystem } from "@/phaser/systems/ProximitySystem";
import { createNpc } from "@/phaser/entities/npcs";

interface WorldInteractionSystemOptions {
  buildingZones: BuildingZoneNode[];
  buildings: Record<string, BuildingZoneNode>;
  npcs: Record<string, NpcNode>;
  /** Scene-specific NPC spawn definitions. Pass the correct list per scene (e.g. TOWN_NPC_POSITIONS). */
  npcPositions: NpcPositionDef[];
  player: () => Player | undefined;
  proximity: () => ProximitySystem | undefined;
}

const BUILDING_TEXTURE: Record<string, string> = {
  house: "building_house",
  market: "building_market",
  firepit_1: "building_firepit",
  firepit_2: "building_firepit",
  blacksmith: "building_blacksmith",
  bank: "building_market",
  cabin: "building_cabin",
};

const BUILDING_SFX: Record<string, string> = {
  firepit_1: "sfx_kitchen",
  firepit_2: "sfx_kitchen",
  blacksmith: "sfx_shop",
  bank: "sfx_bank",
  house: "sfx_home_door",
  market: "sfx_shop",
  barn: "sfx_barn",
};

/** Owns world actor presentation, modal range tracking, and world-level UI events. */
export class WorldInteractionSystem {
  private activeBuilding: BuildingZoneNode | null = null;
  private activeNpc: NpcNode | null = null;
  private onSetZoom?: (event: Event) => void;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: WorldInteractionSystemOptions,
  ) {}

  create(): void {
    this.destroyed = false;
    this.spawnBuildings();
    this.spawnNpcs();
    this.onSetZoom = (event: Event) => {
      const zoom = (event as CustomEvent<{ zoom: number }>).detail?.zoom;
      if (zoom >= 2.5 && zoom <= 4) this.scene.cameras.main.setZoom(zoom);
    };
    window.addEventListener("phaser-set-zoom", this.onSetZoom);
  }

  update(): void {
    const player = this.options.player();
    const proximity = this.options.proximity();
    if (!player || !proximity) return;
    if (this.activeBuilding && !isBuildingInRange(this.activeBuilding, player.sprite.x, player.sprite.y)) {
      dispatchUiEvent(`phaser-${this.activeBuilding.type}-close`);
      this.activeBuilding = null;
    }
    if (this.activeNpc && !proximity.isNodeInRange(this.activeNpc as unknown as PlotNode)) {
      dispatchUiEvent(this.activeNpc.event.replace(/-open$/, "-close"));
      this.activeNpc = null;
    }
  }

  hitNpc(worldX: number, worldY: number): NpcNode | null {
    return Object.values(this.options.npcs).find((npc) =>
      worldX >= npc.x && worldX < npc.x + npc.width &&
      worldY >= npc.y && worldY < npc.y + npc.height,
    ) ?? null;
  }

  interactNpc(npc: NpcNode): void {
    if (!this.options.proximity()?.isNodeInRange(npc as unknown as PlotNode)) return;
    this.activeNpc = npc;
    dispatchUiEvent(npc.event, { npc });
    if (this.scene.cache.audio.has("sfx_npc")) this.scene.sound.play("sfx_npc", { volume: 0.4 });
  }

  hitBuilding(worldX: number, worldY: number): BuildingZoneNode | null {
    return this.options.buildingZones.find((zone) =>
      worldX >= zone.x && worldX < zone.x + zone.width &&
      worldY >= zone.y && worldY < zone.y + zone.height,
    ) ?? null;
  }

  interactBuilding(zone: BuildingZoneNode): void {
    const player = this.options.player();
    if (!player || !isBuildingInRange(zone, player.sprite.x, player.sprite.y)) return;
    this.activeBuilding = zone;
    dispatchUiEvent(`phaser-${zone.type}-open`, { zone });
    const sound = BUILDING_SFX[zone.type];
    if (sound && this.scene.cache.audio.has(sound)) this.scene.sound.play(sound, { volume: 0.4 });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.onSetZoom) window.removeEventListener("phaser-set-zoom", this.onSetZoom);
    this.onSetZoom = undefined;
    this.activeBuilding = null;
    this.activeNpc = null;
  }

  private spawnBuildings(): void {
    const seen: Record<string, number> = {};
    for (const zone of this.options.buildingZones) {
      const texture = BUILDING_TEXTURE[zone.type];
      if (texture && this.scene.textures.exists(texture)) {
        zone.sprite = this.scene.add.image(zone.x, zone.y, texture)
          .setOrigin(0, 0)
          .setDisplaySize(zone.width, zone.height)
          .setDepth(12);
      }
      // Several zones can share a type (e.g. two firepits) — keep ids unique.
      const count = (seen[zone.type] = (seen[zone.type] ?? 0) + 1);
      zone.id = count === 1 ? `building_${zone.type}` : `building_${zone.type}_${count}`;
      this.options.buildings[zone.id] = zone;
    }
  }

  private spawnNpcs(): void {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    for (const definition of this.options.npcPositions) {
      const npc = createNpc(this.scene, definition, tileSize);
      this.options.npcs[npc.node.id] = npc.node;
    }
  }
}

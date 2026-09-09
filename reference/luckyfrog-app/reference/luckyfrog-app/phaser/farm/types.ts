import type Phaser from "phaser";

export interface SpatialNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResourceNode extends SpatialNode {
  nodeId?: string;
  isDepleted: boolean;
  type?: string;
  hitCount?: number;
  depletedAt?: number;
  sprite?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  animSprite?: Phaser.GameObjects.Sprite;
  progressOverlay?: Phaser.GameObjects.Image;
}

export interface PlotNode extends SpatialNode {
  plotId: string;
  fieldIndex: number;
  isDepleted: boolean;
  requiredLevel: number;
  sprite?: Phaser.GameObjects.Image;
  cropSprite?: Phaser.GameObjects.Image | null;
  lockIcon?: Phaser.GameObjects.Image;
}

export interface BuildingZoneNode extends SpatialNode {
  type: string;
  id?: string;
  sprite?: Phaser.GameObjects.Image;
}

export interface NpcNode extends SpatialNode {
  id: string;
  texture: string;
  event: string;
  sprite: Phaser.GameObjects.Sprite;
}

export type AnimalType = "chicken" | "cow" | "sheep";

export interface AnimalNode {
  type: AnimalType;
  index: number;
  sprite: Phaser.GameObjects.Sprite | null;
  cropIcon: Phaser.GameObjects.Image | null;
  exprIcon: Phaser.GameObjects.Image | null;
  _timer: Phaser.Time.TimerEvent | null;
  proximityNode?: PlotNode;
}

export interface FishingNode {
  id: string;
  depth: number;
  event: string;
  tiles: Set<string> | null;
}

export interface MobileHint {
  type: string;
  icon: string;
  crop?: string;
  animal?: string;
}

export interface NodeTooltipData {
  kind: "depleted" | "growing" | "animal";
  screenX: number;
  screenY: number;
  nodeType?: string;
  choppedAt?: number;
  recoverySecs?: number;
  cropName?: string;
  plantedAt?: number;
  harvestMs?: number;
  animalType?: string;
  produceName?: string;
  produceIcon?: string;
  fedAt?: number;
  produceMs?: number;
}

export interface FarmNodeRegistry {
  trees: Record<string, ResourceNode>;
  stones: Record<string, ResourceNode>;
  plots: Record<string, PlotNode>;
  buildings: Record<string, BuildingZoneNode>;
  buildingZones: BuildingZoneNode[];
  npcs: Record<string, NpcNode>;
  animals: Record<string, AnimalNode>;
  fishing: Record<string, FishingNode>;
}

export function createFarmNodeRegistry(): FarmNodeRegistry {
  return { trees: {}, stones: {}, plots: {}, buildings: {}, buildingZones: [], npcs: {}, animals: {}, fishing: {} };
}

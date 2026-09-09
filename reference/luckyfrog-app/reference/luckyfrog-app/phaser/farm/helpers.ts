import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { BuildingZoneNode, SpatialNode } from "@/phaser/farm/types";

export function getSkillLevel(experience: number): number {
  let level = 1;
  let accumulated = 0;
  while (level < 100) {
    accumulated += Math.floor(100 * Math.pow(level, 1.6));
    if (accumulated > experience) break;
    level += 1;
  }
  return level;
}

export function getNodeAtTile<T extends SpatialNode>(nodes: T[], tileX: number, tileY: number): T | null {
  const size = GAME_CONFIG.TILE_SIZE;
  const x = tileX * size;
  const y = tileY * size;
  return nodes.find((node) => {
    const depleted = "isDepleted" in node && Boolean(node.isDepleted);
    return !depleted && x >= node.x && x < node.x + node.width && y >= node.y && y < node.y + node.height;
  }) ?? null;
}

export function isBuildingInRange(zone: BuildingZoneNode, playerX: number, playerY: number): boolean {
  const size = GAME_CONFIG.TILE_SIZE;
  const radius = GAME_CONFIG.BUILDING_INTERACTION_RADIUS_TILES;
  const px = Math.floor(playerX / size);
  const py = Math.floor(playerY / size);
  const left = Math.floor(zone.x / size);
  const top = Math.floor(zone.y / size);
  const width = Math.ceil(zone.width / size);
  const height = Math.ceil(zone.height / size);
  for (let x = left; x < left + width; x += 1) {
    for (let y = top; y < top + height; y += 1) {
      if (Math.abs(px - x) <= radius && Math.abs(py - y) <= radius) return true;
    }
  }
  return false;
}

export function dispatchUiEvent(name: string, detail: Record<string, unknown> = {}): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

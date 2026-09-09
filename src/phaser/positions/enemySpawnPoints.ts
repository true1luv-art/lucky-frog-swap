import type { EnemyType } from "@/features/game/enemies";

export interface EnemySpawnPoint {
  id: string;
  /** Tile coordinates on the 40×40 farm map. */
  x: number;
  y: number;
  type: EnemyType;
}

/**
 * Spawn points sit away from the plots and buildings so farming stays safe and
 * combat happens when the player walks out to the map edges.
 */
export const ENEMY_SPAWN_POINTS: EnemySpawnPoint[] = [
  { id: "forest_east",  x: 37, y: 13, type: "goblin" },
  { id: "forest_east2", x: 35, y: 16, type: "goblin" },
  { id: "north_ridge",  x: 17, y: 4,  type: "goblin" },
  { id: "ruins_west",   x: 5,  y: 27, type: "skeleton" },
  { id: "plains_south", x: 29, y: 35, type: "wolf" },
];

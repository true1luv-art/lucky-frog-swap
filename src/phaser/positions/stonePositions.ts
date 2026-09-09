import type { ResourcePositionDef } from './treePositions'

export type { ResourcePositionDef }

// Positions derived from the stone_spawns object layer in farm.json.
// x/y are tile coords (pixel / 16). All stone positions share the same node
// type — ore drops are determined at mine-time by the player's pickaxe tier.
export const STONE_POSITIONS: ResourcePositionDef[] = [
  { id: 'stone_01', x: 35, y: 23 },
  { id: 'stone_02', x: 18, y: 21 },
  { id: 'stone_03', x: 18, y: 35 },
  { id: 'stone_04', x: 1,  y: 24 },
  { id: 'stone_05', x: 7,  y: 11 },
]

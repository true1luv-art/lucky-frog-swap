import type { ResourcePositionDef } from './treePositions'

export type { ResourcePositionDef }

// Positions derived from the stone_spawns object layer in farm.json.
// x/y are tile coords (pixel / 16). All stone positions share the same node
// type — ore drops are determined at mine-time by the player's pickaxe tier.
export const STONE_POSITIONS: ResourcePositionDef[] = [
  { id: 'stone_01', x: 36, y: 10 },
  { id: 'stone_02', x: 28, y: 17 },
  { id: 'stone_03', x: 28, y: 21 },
  { id: 'stone_04', x: 32, y: 25 },
  { id: 'stone_05', x: 37, y: 28 },
  { id: 'stone_06', x: 33, y: 35 },
  { id: 'stone_07', x: 26, y: 32 },
  { id: 'stone_08', x: 7,  y: 13 },
  { id: 'stone_09', x: 27, y: 4  },
  { id: 'stone_10', x: 25, y: 12 },
  { id: 'stone_11', x: 17, y: 2  },
]

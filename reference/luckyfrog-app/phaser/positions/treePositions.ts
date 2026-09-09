export interface ResourcePositionDef {
  id: string
  x: number
  y: number
}

// Positions derived from the tree_spawns object layer in farm.json.
// x/y are tile coords (pixel / 16).
export const TREE_POSITIONS: ResourcePositionDef[] = [
  { id: 'tree_01', x: 1,  y: 2  },
  { id: 'tree_02', x: 1,  y: 12 },
  { id: 'tree_03', x: 3,  y: 15 },
  { id: 'tree_04', x: 22, y: 17 },
  { id: 'tree_05', x: 21, y: 32 },
  { id: 'tree_06', x: 37, y: 36 },
  { id: 'tree_07', x: 22, y: 35 },
  { id: 'tree_08', x: 29, y: 36 },
  { id: 'tree_09', x: 31, y: 30 },
  { id: 'tree_10', x: 37, y: 21 },
  { id: 'tree_11', x: 29, y: 10 },
]

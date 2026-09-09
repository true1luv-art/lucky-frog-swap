export interface ResourcePositionDef {
  id: string
  x: number
  y: number
}

// Positions derived from the tree_spawns object layer in farm.json.
// x/y are tile coords (pixel / 16).
export const TREE_POSITIONS: ResourcePositionDef[] = [
  { id: 'tree_01', x: 27, y: 13 },
  { id: 'tree_02', x: 24, y: 10 },
  { id: 'tree_03', x: 25, y: 6  },
  { id: 'tree_04', x: 28, y: 3  },
  { id: 'tree_05', x: 31, y: 5  },
]

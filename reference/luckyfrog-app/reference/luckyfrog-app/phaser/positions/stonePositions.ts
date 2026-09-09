export interface ResourcePositionDef {
  id: string
  x: number
  y: number
}

export const STONE_POSITIONS: ResourcePositionDef[] = [
  { id: 'stone_01', x: 50, y: 3 },
  { id: 'stone_02', x: 56, y: 7 },
  { id: 'stone_03', x: 50, y: 7 },
  { id: 'stone_04', x: 56, y: 3 },
]

export const IRON_POSITIONS: ResourcePositionDef[] = [
  { id: 'iron_01', x: 29, y: 2 },
  { id: 'iron_02', x: 25, y: 30 },
]

export const GOLD_POSITIONS: ResourcePositionDef[] = [
  { id: 'gold_01', x: 35, y: 8 },
  { id: 'gold_02', x: 44, y: 32 },
]

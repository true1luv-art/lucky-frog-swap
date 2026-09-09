export const BUILDING_KEYS = [
  'summoning_shrine',
] as const

export type BuildingKey = (typeof BUILDING_KEYS)[number]

export interface BuildingZoneDef {
  type: string
  x: number
  y: number
  width: number
  height: number
}

export const BUILDING_POSITIONS: BuildingZoneDef[] = [
  { type: 'house', x: 10, y: 14, width: 3, height: 4 },
  { type: 'kitchen', x: 36, y: 12, width: 3, height: 3 },
  { type: 'market', x: 30, y: 16, width: 3, height: 3 },
  { type: 'blacksmith', x: 21, y: 3, width: 5, height: 4 },
  // summoning_shrine.png — 32×48 px native (2:3) → displayed at 2×3 tiles
  { type: 'summoning_shrine', x: 16, y: 16, width: 2, height: 3 },
]

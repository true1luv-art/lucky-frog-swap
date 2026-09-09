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
  { type: 'house', x: 34, y: 1, width: 3, height: 4 },
  { type: 'market', x: 33, y: 17, width: 3, height: 3 },
  { type: 'blacksmith', x: 46, y: 19, width: 6, height: 4 },
  { type: 'kitchen', x: 24, y: 17, width: 3, height: 3 },
  // uses the market building image (46×43, ~square) → 3×3 tiles
  { type: 'bank', x: 39, y: 11, width: 3, height: 3 },
  // summoning_shrine.png — 32×48 px native (2:3) → displayed at 2×3 tiles
  { type: 'summoning_shrine', x: 29, y: 8, width: 2, height: 3 },
]

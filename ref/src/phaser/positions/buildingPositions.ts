export const BUILDING_KEYS: readonly string[] = []

export type BuildingKey = string

export interface BuildingZoneDef {
  type: string
  x: number
  y: number
  width: number
  height: number
}

export const BUILDING_POSITIONS: BuildingZoneDef[] = [
  { type: 'house', x: 5, y: 5, width: 3, height: 4 },
  // firepit.png — 2×2 tiles; both firepits open the cooking modal
  { type: 'firepit_1', x: 30, y: 9, width: 2, height: 2 },
  { type: 'firepit_2', x: 15, y: 26, width: 2, height: 2 },

  // market.png / blacksmith.png — 80×80 px native → displayed at 5×5 tiles
  { type: 'market', x: 14, y: 1, width: 5, height: 5 },
  { type: 'blacksmith', x: 34, y: 1, width: 5, height: 5 },
]

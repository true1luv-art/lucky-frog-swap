// Fishing zone derived from the boundary_pond tile layer in farm.json.
// scanRows list every tile row that contains pond tiles, with the min/max
// column range per row. The player can cast when standing on or adjacent to
// any of these tiles. anchorTile is the display-popup / interaction hotspot
// positioned just to the right of the pond's top-right corner.

export interface FishingZoneDef {
  id: string
  label: string
  depth: number
  event: string
  anchorTile: { x: number; y: number }
  scanRows: Array<{ y: number; xMin: number; xMax: number }>
}

export const FISHING_POSITIONS: FishingZoneDef[] = [
  {
    id:    'fishing_zone_lake',
    label: 'Lake',
    depth: 100,
    event: 'phaser-fishing-open',
    // One tile to the right of the pond's top row — where the player stands to cast.
    anchorTile: { x: 12, y: 31 },
    // Derived from boundary_pond tile layer (farm.json).
    scanRows: [
      { y: 31, xMin: 4, xMax: 11 },
      { y: 32, xMin: 3, xMax: 12 },
      { y: 33, xMin: 3, xMax: 12 },
      { y: 34, xMin: 3, xMax: 12 },
      { y: 35, xMin: 3, xMax: 12 },
      { y: 36, xMin: 4, xMax: 11 },
    ],
  },
]


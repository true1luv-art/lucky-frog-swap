// Fishing zone derived from the bondary_fishing tile layer in farm.json.
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
    anchorTile: { x: 10, y: 4 },
    // Derived from bondary_fishing tile layer (farm.json). Each row lists the
    // column range that contains pond/water tiles on that row.
    scanRows: [
      { y:  4, xMin: 4, xMax:  9 },
      { y:  5, xMin: 3, xMax: 10 },
      { y:  6, xMin: 3, xMax: 10 },
      { y:  7, xMin: 3, xMax:  8 },
      { y:  8, xMin: 3, xMax: 10 },
      { y:  9, xMin: 3, xMax: 10 },
      { y: 10, xMin: 3, xMax: 10 },
      { y: 11, xMin: 4, xMax:  9 },
    ],
  },
]

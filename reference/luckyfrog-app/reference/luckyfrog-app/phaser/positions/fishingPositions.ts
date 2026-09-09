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
    // Lake water sits at x=3-4; dock runs at x=5 beside it
    anchorTile: { x: 5, y: 14 },
    scanRows: [
      { y:  4, xMin: 3, xMax: 5 },
      { y:  8, xMin: 3, xMax: 5 },
      { y: 12, xMin: 3, xMax: 5 },
      { y: 16, xMin: 3, xMax: 5 },
      { y: 20, xMin: 3, xMax: 5 },
      { y: 24, xMin: 3, xMax: 5 },
    ],
  },
]

export interface AnimalSpawnDef {
  index: number
  x: number
  y: number
}

// The barn building sits at x51-57 (y23-29). Directly in front of / below it is
// a large dirt paddock (x50-58, y30-37) — the brown tilled ground where animals
// graze. BARN_ZONE covers that whole paddock so it reads as the animal enclosure.
export const BARN_ZONE = { x: 50, y: 30, width: 9, height: 8 }

// All spawn tiles below are verified clear dirt inside the paddock.
export const CHICKEN_SPAWN_POSITIONS: AnimalSpawnDef[] = [
  { index: 0, x: 50, y: 30 },
  { index: 1, x: 52, y: 30 },
  { index: 2, x: 54, y: 30 },
  { index: 3, x: 56, y: 30 },
  { index: 4, x: 58, y: 30 },
  { index: 5, x: 50, y: 31 },
  { index: 6, x: 52, y: 31 },
  { index: 7, x: 54, y: 31 },
  { index: 8, x: 56, y: 31 },
  { index: 9, x: 58, y: 31 },
]

export const COW_SPAWN_POSITIONS: AnimalSpawnDef[] = [
  { index: 0, x: 51, y: 33 },
  { index: 1, x: 54, y: 33 },
  { index: 2, x: 57, y: 33 },
  { index: 3, x: 52, y: 34 },
  { index: 4, x: 55, y: 34 },
]

export const SHEEP_SPAWN_POSITIONS: AnimalSpawnDef[] = [
  { index: 0, x: 50, y: 36 },
  { index: 1, x: 53, y: 36 },
  { index: 2, x: 56, y: 36 },
  { index: 3, x: 51, y: 37 },
  { index: 4, x: 54, y: 37 },
]

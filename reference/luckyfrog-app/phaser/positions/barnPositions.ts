export interface AnimalSpawnDef {
  index: number
  x: number
  y: number
}

// BARN_ZONE derived from the boundary_barn tile layer in farm.json.
// This is the animal enclosure — the zone animals roam in, NOT a player
// collision boundary. x/y/width/height are in tile coordinates.
export const BARN_ZONE = { x: 1, y: 25, width: 19, height: 12 }

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

export interface AnimalSpawnDef {
  index: number
  x: number
  y: number
}

// BARN_ZONE derived from the boundary_ranch tile layer in farm.json.
// This is the animal enclosure — the zone animals roam in, NOT a player
// collision boundary. x/y/width/height are in tile coordinates.
export const BARN_ZONE = { x: 22, y: 28, width: 15, height: 8 }

// All spawn tiles below sit inside the ranch paddock (x 22–36, y 28–35).
export const CHICKEN_SPAWN_POSITIONS: AnimalSpawnDef[] = [
  { index: 0, x: 23, y: 29 },
  { index: 1, x: 25, y: 29 },
  { index: 2, x: 27, y: 29 },
  { index: 3, x: 29, y: 29 },
  { index: 4, x: 31, y: 29 },
  { index: 5, x: 23, y: 30 },
  { index: 6, x: 25, y: 30 },
  { index: 7, x: 27, y: 30 },
  { index: 8, x: 29, y: 30 },
  { index: 9, x: 31, y: 30 },
]

export const COW_SPAWN_POSITIONS: AnimalSpawnDef[] = [
  { index: 0, x: 24, y: 32 },
  { index: 1, x: 27, y: 32 },
  { index: 2, x: 30, y: 32 },
  { index: 3, x: 25, y: 33 },
  { index: 4, x: 28, y: 33 },
]

export const SHEEP_SPAWN_POSITIONS: AnimalSpawnDef[] = [
  { index: 0, x: 32, y: 34 },
  { index: 1, x: 34, y: 34 },
  { index: 2, x: 36, y: 34 },
  { index: 3, x: 33, y: 35 },
  { index: 4, x: 35, y: 35 },
]

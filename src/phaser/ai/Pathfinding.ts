/**
 * phaser/ai/Pathfinding.ts
 *
 * Tile-grid A* pathfinding plus a straight-line sight test.
 * Engine-agnostic: the caller supplies a `isBlocked(tileX, tileY)` predicate,
 * so the same code works for the farm map, the editor preview, or tests.
 */

import { GAME_CONFIG } from "@/phaser/config/GameConfig";

const TS = GAME_CONFIG.TILE_SIZE;

export interface TilePoint {
  x: number;
  y: number;
}

export interface PathfindOptions {
  /** Returns true when the tile cannot be walked through. */
  isBlocked: (tileX: number, tileY: number) => boolean;
  /** Allow 8-way movement (diagonals cut corners only when both sides are free). */
  allowDiagonal?: boolean;
  /** Safety cap so a hopeless search can never stall a frame. */
  maxNodes?: number;
}

export function toTile(worldX: number, worldY: number): TilePoint {
  return { x: Math.floor(worldX / TS), y: Math.floor(worldY / TS) };
}

export function toWorldCenter(tile: TilePoint): { x: number; y: number } {
  return { x: tile.x * TS + TS / 2, y: tile.y * TS + TS / 2 };
}

const STRAIGHT: TilePoint[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
];
const DIAGONAL: TilePoint[] = [
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

const key = (x: number, y: number) => `${x},${y}`;

/**
 * A* over the tile grid. Returns tile steps from (but excluding) `start`
 * through `goal`, or an empty array when no route exists.
 */
export function findPath(start: TilePoint, goal: TilePoint, opts: PathfindOptions): TilePoint[] {
  const { isBlocked, allowDiagonal = true, maxNodes = 2500 } = opts;
  if (start.x === goal.x && start.y === goal.y) return [];
  // The player can stand on a tile the enemy cannot enter (edges, corners).
  // Aim for the closest tile it *can* reach instead of giving up.
  let target = goal;
  if (isBlocked(target.x, target.y)) {
    const alt = nearestWalkable(goal, isBlocked);
    if (!alt) return [];
    target = alt;
    if (start.x === target.x && start.y === target.y) return [];
  }
  goal = target;

  const neighbours = allowDiagonal ? [...STRAIGHT, ...DIAGONAL] : STRAIGHT;
  const open: Array<{ tile: TilePoint; f: number }> = [{ tile: start, f: 0 }];
  const cameFrom = new Map<string, TilePoint>();
  const gScore = new Map<string, number>([[key(start.x, start.y), 0]]);
  let visited = 0;

  while (open.length > 0 && visited < maxNodes) {
    // Small open sets — a linear scan beats the overhead of a heap here.
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bestIndex].f) bestIndex = i;
    const current = open.splice(bestIndex, 1)[0].tile;
    visited += 1;

    if (current.x === goal.x && current.y === goal.y) {
      return reconstruct(cameFrom, current);
    }

    for (const step of neighbours) {
      const nx = current.x + step.x;
      const ny = current.y + step.y;
      if (isBlocked(nx, ny)) continue;
      // Don't squeeze between two blocked tiles diagonally.
      if (step.x !== 0 && step.y !== 0) {
        if (isBlocked(current.x + step.x, current.y) || isBlocked(current.x, current.y + step.y)) continue;
      }
      const cost = step.x !== 0 && step.y !== 0 ? Math.SQRT2 : 1;
      const tentative = (gScore.get(key(current.x, current.y)) ?? Infinity) + cost;
      const nKey = key(nx, ny);
      if (tentative >= (gScore.get(nKey) ?? Infinity)) continue;

      cameFrom.set(nKey, current);
      gScore.set(nKey, tentative);
      const h = heuristic({ x: nx, y: ny }, goal, allowDiagonal);
      open.push({ tile: { x: nx, y: ny }, f: tentative + h });
    }
  }

  return [];
}

function heuristic(a: TilePoint, b: TilePoint, diagonal: boolean): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return diagonal
    ? (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy)
    : dx + dy;
}

function reconstruct(cameFrom: Map<string, TilePoint>, end: TilePoint): TilePoint[] {
  const path: TilePoint[] = [end];
  let node = end;
  while (cameFrom.has(key(node.x, node.y))) {
    node = cameFrom.get(key(node.x, node.y))!;
    path.push(node);
  }
  path.reverse();
  return path.slice(1);
}

/**
 * Bresenham line-of-sight between two tiles. When this is true an entity can
 * just walk straight at its target and skip the A* search entirely.
 */
export function hasLineOfSight(
  from: TilePoint,
  to: TilePoint,
  isBlocked: (tileX: number, tileY: number) => boolean,
): boolean {
  let x0 = from.x;
  let y0 = from.y;
  const dx = Math.abs(to.x - x0);
  const dy = -Math.abs(to.y - y0);
  const sx = x0 < to.x ? 1 : -1;
  const sy = y0 < to.y ? 1 : -1;
  let err = dx + dy;

  for (let guard = 0; guard < 512; guard++) {
    if (x0 === to.x && y0 === to.y) return true;
    if (!(x0 === from.x && y0 === from.y) && isBlocked(x0, y0)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return false;
}

/**
 * Drops path steps the entity has already reached and returns the next
 * world-space waypoint, or null when the path is exhausted.
 */
export function nextWaypoint(
  path: TilePoint[],
  worldX: number,
  worldY: number,
  reachedPx = 4,
): { x: number; y: number } | null {
  while (path.length > 0) {
    const target = toWorldCenter(path[0]);
    if (Math.hypot(target.x - worldX, target.y - worldY) <= reachedPx) {
      path.shift();
      continue;
    }
    return target;
  }
  return null;
}

/** Closest walkable tile to `tile` within a small ring search. */
export function nearestWalkable(
  tile: TilePoint,
  isBlocked: (tileX: number, tileY: number) => boolean,
  maxRadius = 3,
): TilePoint | null {
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tile.x + dx;
        const y = tile.y + dy;
        if (!isBlocked(x, y)) return { x, y };
      }
    }
  }
  return null;
}

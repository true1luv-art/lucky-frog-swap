import { HeroState } from "@/features/types/HeroState";
import { MAP_HEIGHT, MAP_WIDTH, TileType, isDestructible } from "@/features/types/TileTypes";
import type { Hero } from "../entities/Hero";
import type { MapManager } from "./MapManager";
import type { Pathfinding, PathNode } from "../systems/Pathfinding";
import type { BombManager } from "./BombManager";
import type { LootManager } from "./LootManager";
import type { ExplosionManager } from "./ExplosionManager";

interface PendingPath {
  requested: boolean;
  onDone?: (path: PathNode[] | null) => void;
}

export class AIManager {
  private map: MapManager;
  private pathfinding: Pathfinding;
  private bombs: BombManager;
  private loot: LootManager;
  private explosions: ExplosionManager;
  private pending = new WeakMap<Hero, PendingPath>();
  /** heroId -> "x,y" of breakable it's currently targeting. Prevents two heroes chasing the same tile. */
  private targetedBreakables = new Map<string, string>();

  constructor(
    map: MapManager,
    pathfinding: Pathfinding,
    bombs: BombManager,
    loot: LootManager,
    explosions: ExplosionManager,
  ) {
    this.map = map;
    this.pathfinding = pathfinding;
    this.bombs = bombs;
    this.loot = loot;
    this.explosions = explosions;
  }

  update(hero: Hero, now: number, deltaSec: number, stepAlong: (h: Hero, dt: number) => boolean): void {
    // If we're waiting on an async pathfinder result, do nothing this tick.
    if (this.pending.get(hero)?.requested) return;

    switch (hero.state) {
      case HeroState.Searching:
        this.doSearch(hero);
        break;

      case HeroState.Moving: {
        const done = stepAlong(hero, deltaSec);
        if (done) {
          // If we were just wandering (no breakable target), search again on
          // arrival. Otherwise we've reached the plant spot next to a target.
          hero.state = hero.roaming ? HeroState.Searching : HeroState.PlantBomb;
          hero.roaming = false;
        }
        break;
      }

      case HeroState.PlantBomb:
        this.doPlantBomb(hero, now);
        break;

      case HeroState.Escaping: {
        const done = stepAlong(hero, deltaSec);
        if (done) {
          // Heroes never idle — always go back to searching. BFS avoids tiles
          // inside our currently-planted bomb blasts, and doSearch falls back
          // to wandering when no breakable is reachable, so the hero keeps
          // walking around the map.
          hero.state = HeroState.Searching;
        }
        break;
      }
    }
  }

  // -------- state handlers --------

  private doSearch(hero: Hero): void {
    // Release any prior reservation before picking a new target.
    this.targetedBreakables.delete(hero.id);
    const danger = this.getAllDangerTiles();
    const reserved = new Set(this.targetedBreakables.values());
    const found = this.findNearestReachableBreakable(hero.tileX, hero.tileY, danger, reserved);
    if (!found) {
      // No breakable reachable — wander to a random tile so the hero keeps
      // walking the map instead of standing still.
      this.doRoam(hero, danger);
      return;
    }
    hero.roaming = false;
    hero.targetBreakable = { x: found.breakable.x, y: found.breakable.y };
    this.targetedBreakables.set(hero.id, `${found.breakable.x},${found.breakable.y}`);
    if (found.standAt.x === hero.tileX && found.standAt.y === hero.tileY) {
      hero.state = HeroState.PlantBomb;
      return;
    }
    this.requestPath(hero, found.standAt.x, found.standAt.y, HeroState.Moving);
  }

  private findNearestReachableBreakable(
    sx: number,
    sy: number,
    danger: Set<string> = new Set(),
    reserved: Set<string> = new Set(),
  ): { standAt: PathNode; breakable: PathNode } | null {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    const startKey = `${sx},${sy}`;
    const visited = new Set<string>([startKey]);
    const queue: PathNode[] = [{ x: sx, y: sy }];
    while (queue.length) {
      const cur = queue.shift()!;
      const standSafe = !danger.has(`${cur.x},${cur.y}`);
      if (standSafe) {
        for (const [dx, dy] of dirs) {
          const nx = cur.x + dx;
          const ny = cur.y + dy;
          const t = this.map.grid[ny]?.[nx];
          if (t === undefined) continue;
          if (reserved.has(`${nx},${ny}`)) continue;
          // Always take the closest breakable — chest or bush alike. BFS
          // explores stand tiles in increasing distance, so the first hit is
          // the nearest reachable one.
          if (isDestructible(t as TileType)) {
            return { standAt: cur, breakable: { x: nx, y: ny } };
          }
        }
      }
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (!this.pathfinding.isWalkable(nx, ny)) continue;
        if (danger.has(key)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  private doPlantBomb(hero: Hero, _now: number): void {
    // Enforce the hero's Bomb Number stat: never have more than `bombNum`
    // of this hero's bombs planted at once. A Common (bombNum 1) can only
    // ever have a single live bomb before it must wait for detonation.
    if (this.bombs.countByOwner(hero.id) >= hero.bombNum) {
      this.targetedBreakables.delete(hero.id);
      hero.state = HeroState.Searching;
      return;
    }
    const danger = this.getAllDangerTiles();
    // Don't stack our bomb on top of another hero's bomb blast — find another target instead.
    if (danger.has(`${hero.tileX},${hero.tileY}`)) {
      this.targetedBreakables.delete(hero.id);
      hero.state = HeroState.Searching;
      return;
    }
    if (!this.hasBreakableInBlast(hero.tileX, hero.tileY, hero.bombRange)) {
      this.targetedBreakables.delete(hero.id);
      hero.state = HeroState.Searching;
      return;
    }
    // Damage = hero Power stat (per Bomb Sol spec).
    this.bombs.spawn(hero.tileX, hero.tileY, hero.bombRange, hero.id, 700, hero.power);
    // Reservation released — bomb will destroy the target shortly.
    this.targetedBreakables.delete(hero.id);
    const dangerAfter = this.getAllDangerTiles();
    const escape = this.findEscapeTile(hero.tileX, hero.tileY, dangerAfter);
    if (!escape) {
      hero.state = HeroState.Searching;
      return;
    }
    this.requestPath(hero, escape.x, escape.y, HeroState.Escaping);
  }

  /** Union of blast tiles for every currently-planted bomb. */
  private getAllDangerTiles(): Set<string> {
    const s = new Set<string>();
    for (const b of this.bombs.getBombs()) {
      for (const t of this.tilesInBlast(b.tileX, b.tileY, b.range)) s.add(t);
    }
    return s;
  }


  private hasBreakableInBlast(bx: number, by: number, range: number): boolean {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dy] of dirs) {
      for (let step = 1; step <= range; step++) {
        const x = bx + dx * step;
        const y = by + dy * step;
        const t = this.map.grid[y]?.[x];
        if (t === undefined || t === TileType.Wall) break;
        if (isDestructible(t as TileType)) return true;
      }
    }
    return false;
  }


  /**
   * Wander: pick a random reachable, non-dangerous tile and walk to it. Keeps
   * heroes constantly moving around the map when there's nothing to bomb.
   */
  private doRoam(hero: Hero, danger: Set<string>): void {
    const target = this.pickRoamTarget(hero.tileX, hero.tileY, danger);
    if (!target) {
      // Truly boxed in — try again next tick.
      hero.state = HeroState.Searching;
      return;
    }
    hero.roaming = true;
    this.requestPath(hero, target.x, target.y, HeroState.Moving);
  }

  /** BFS out from the hero, collecting reachable safe tiles, then pick one. */
  private pickRoamTarget(sx: number, sy: number, danger: Set<string>): PathNode | null {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const visited = new Set<string>([`${sx},${sy}`]);
    const queue: { x: number; y: number; d: number }[] = [{ x: sx, y: sy, d: 0 }];
    const candidates: PathNode[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      // Prefer tiles a few steps away so the hero actually travels.
      if (cur.d >= 3) candidates.push({ x: cur.x, y: cur.y });
      if (cur.d > 14) continue;
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (!this.pathfinding.isWalkable(nx, ny)) continue;
        if (danger.has(key)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny, d: cur.d + 1 });
      }
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // -------- helpers --------

  private findNearestBreakable(sx: number, sy: number): PathNode | null {
    // Manhattan-nearest breakable.
    let best: PathNode | null = null;
    let bestD = Infinity;
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        const t = this.map.grid[y][x];
        if (!isDestructible(t)) continue;
        const d = Math.abs(x - sx) + Math.abs(y - sy);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    return best;
  }

  private findAdjacentWalkable(
    tx: number,
    ty: number,
    fromX: number,
    fromY: number,
  ): PathNode | null {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let best: PathNode | null = null;
    let bestD = Infinity;
    for (const [dx, dy] of dirs) {
      const x = tx + dx;
      const y = ty + dy;
      if (!this.pathfinding.isWalkable(x, y)) continue;
      const d = Math.abs(x - fromX) + Math.abs(y - fromY);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    return best;
  }

  private tilesInBlast(bx: number, by: number, range: number): Set<string> {
    const s = new Set<string>();
    s.add(`${bx},${by}`);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      for (let step = 1; step <= range; step++) {
        const x = bx + dx * step;
        const y = by + dy * step;
        const t = this.map.grid[y]?.[x];
        if (t === undefined || t === TileType.Wall) break;
        s.add(`${x},${y}`);
        if (isDestructible(t as TileType)) break;
      }
    }
    return s;
  }

  private findEscapeTile(
    sx: number,
    sy: number,
    danger: Set<string>,
  ): PathNode | null {

    // BFS from (sx,sy) treating walkable tiles; stop at first safe tile far enough.
    const visited = new Set<string>([`${sx},${sy}`]);
    const queue: { x: number; y: number; d: number }[] = [{ x: sx, y: sy, d: 0 }];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.d > 0 && !danger.has(`${cur.x},${cur.y}`)) {
        return { x: cur.x, y: cur.y };
      }
      if (cur.d > 12) continue;
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (!this.pathfinding.isWalkable(nx, ny)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny, d: cur.d + 1 });
      }
    }
    return null;
  }

  private requestPath(
    hero: Hero,
    tx: number,
    ty: number,
    nextState: HeroState,
    onDone?: (path: PathNode[] | null) => void,
  ): void {
    // Prevent duplicate requests
    const pending = this.pending.get(hero);
    if (pending?.requested) return;
    this.pending.set(hero, { requested: true });
    // While path resolves, `update()` short-circuits via the pending guard.
    void this.pathfinding.findPath(hero.tileX, hero.tileY, tx, ty).then((path) => {
      this.pending.delete(hero);
      if (!path || path.length <= 1) {
        // Can't path — reset to searching.
        hero.state = HeroState.Searching;
        hero.path = null;
        hero.pathIndex = 0;
        onDone?.(null);
        return;
      }
      hero.path = path;
      hero.pathIndex = 1; // skip current tile
      hero.state = nextState;
      onDone?.(path);
    });
  }
}

import EasyStar from "easystarjs";
import { TileType } from "@/features/types/TileTypes";

export interface PathNode {
  x: number;
  y: number;
}

export class Pathfinding {
  private es: EasyStar.js;
  private grid: number[][];

  constructor(grid: number[][]) {
    this.grid = grid;
    this.es = new EasyStar.js();
    this.es.setGrid(grid);
    this.es.setAcceptableTiles([TileType.Grass]);
    this.es.disableDiagonals();
    this.es.setIterationsPerCalculation(2000);
  }

  updateTile(x: number, y: number, value: number): void {
    this.grid[y][x] = value;
    this.es.setGrid(this.grid);
  }

  isWalkable(x: number, y: number): boolean {
    if (y < 0 || y >= this.grid.length) return false;
    if (x < 0 || x >= this.grid[0].length) return false;
    return this.grid[y][x] === TileType.Grass;
  }

  getTile(x: number, y: number): number {
    return this.grid[y][x];
  }

  findPath(sx: number, sy: number, tx: number, ty: number): Promise<PathNode[] | null> {
    return new Promise((resolve) => {
      this.es.findPath(sx, sy, tx, ty, (path) => {
        resolve(path ? path.map((p) => ({ x: p.x, y: p.y })) : null);
      });
      this.es.calculate();
    });
  }

  tick(): void {
    this.es.calculate();
  }
}

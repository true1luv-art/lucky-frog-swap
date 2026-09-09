import type { TileType } from "@/features/types/TileTypes";

export interface Block {
  x: number;
  y: number;
  type: TileType;
}

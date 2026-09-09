/**
 * lib/modules/stage-maps/types.server.ts
 *
 * Pure TypeScript types for the `stage-maps` domain.
 * No mongoose runtime code — interfaces only.
 */

import type { Document } from "mongoose";
import type { ChestRarity } from "@/features/types/ChestRarity";

export type NodeKind = "chest" | "bush";

export interface MapNode {
  x: number;
  y: number;
  kind: NodeKind;
  /** Rarity — chests only. */
  rarity?: ChestRarity;
  maxHp: number;
  /** Current hp; 0 = destroyed. */
  hp: number;
  /** Coin reward on destroy. */
  coins: number;
  destroyed: boolean;
}

export interface IStageMap extends Document {
  /** Wallet address — unique (one document per player). */
  playerId: string;
  /** Placeholder stage counter. $inc-remented on stage complete. */
  stage: number;
  /** Seeded PRNG seed used for the CURRENT stage layout. Never accepted from client. */
  seed: number;
  /** Grid width snapshot (MAP_WIDTH = 41). */
  width: number;
  /** Grid height snapshot (MAP_HEIGHT = 25). */
  height: number;
  /** Nodes keyed by "x,y". */
  nodes: Map<string, MapNode>;
  totalChests: number;
  clearedChests: number;
  /**
   * Monotonic hit counter — incremented in memory per accepted mine:hit and
   * written to the DB on each 30 s flush (Phase B/D). Used by backfill
   * selection to compare in-memory progress against the DB snapshot (Phase H).
   */
  mapVersion?: number;
  /**
   * Unix-ms of the last accepted mine:hit written to the DB.
   * Written alongside mapVersion on every flush; read by buildMineState (Phase G).
   */
  lastActionAt?: number;
  createdAt: Date;
  updatedAt: Date;
}

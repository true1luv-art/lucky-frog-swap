/**
 * lib/modules/tools/types.server.ts
 *
 * Pure TypeScript types for the `tools` collection.
 *
 * ONE DOCUMENT PER TOOL INSTANCE. Tools are player-owned — they survive farm
 * resets. Wood tools have durability = null (infinite). Ore-tier tools have
 * finite durability; the document is deleted when it hits 0.
 *
 * Mirrors the ToolInstance shape from features/types/gameplay/tools.ts but
 * extends mongoose Document so it can be used with the Mongoose model.
 */

import type { Document } from "mongoose";
import type { ToolName, ToolTier } from "@/features/types/gameplay/tools";

export interface IToolInstance extends Document {
  /** Wallet address — matches players.wallet. */
  owner: string;

  /**
   * Stable nanoid-style id. Matches the `id` field on the Phaser ToolInstance.
   * Used as the lookup key for durability updates and deletes.
   */
  toolId: string;

  name: ToolName;
  tier: ToolTier;

  /**
   * Current uses remaining. null = infinite (Wood tier).
   * Decremented by 1 per action. Document is deleted when this hits 0.
   */
  durability: number | null;

  /** Maximum durability when newly crafted. null for Wood tier. */
  maxDurability: number | null;

  createdAt: Date;
  updatedAt: Date;
}

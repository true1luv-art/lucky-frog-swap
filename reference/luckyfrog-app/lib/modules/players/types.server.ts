/**
 * lib/modules/players/types.server.ts
 *
 * Pure TypeScript types for the `players` domain.
 * No mongoose runtime code — only interfaces live here.
 */

import type { Document } from "mongoose";
import type { PlayerSkills } from "@/features/types/players";
import type { EmbeddedQuest } from "@/features/types/quests";

/** Aggregate combat stats — sum of all equipped item bonuses (display-only). */
export interface PlayerStats {
  attack:  number;
  defense: number;
  luck:    number;
  speed:   number;
  crit:    number;
}

export interface IPlayer extends Document {
  wallet: string;
  username?: string;

  registrationTime: number;
  referrer?: string;

  /**
   * Embedded skill XP totals. Derive level via `getSkillLevel(xp)`.
   * Each skill progresses independently.
   */
  skills: PlayerSkills;

  /**
   * Aggregate combat stats — sum of all currently equipped item bonuses.
   * Recomputed by equip/upgrade events and cached here for fast profile reads.
   */
  stats: PlayerStats;

  /**
   * In-game coin balance. Earned by selling resources, crops, and food.
   * Spent on seed purchases.
   */
  coins: number;

  /**
   * Lifetime milestone counters (e.g. crops harvested, quests completed).
   * Previously lived on the farm document; moved here so they belong to
   * the player regardless of farm resets.
   */
  milestones: Record<string, number>;

  /**
   * Daily quests — embedded here so they survive farm resets.
   * No history needed, so no separate collection.
   */
  quests: {
    daily: EmbeddedQuest[];
  };

  /**
   * Activity tracking for anti-cheat validation.
   * Stores when each action started to validate that required action duration has elapsed
   * before granting rewards. Prevents timing exploits and data manipulation.
   */
  activity?: {
    lastMinedAt?: number;      // Mine action started (5s required)
    lastChoppedAt?: number;    // Chop action started (5s required)
    lastCastAt?: number;       // Fishing action started (30s required)
    lastCraftAt?: number;      // Smithing action started (30s required)
    lastCookedAt?: number;     // Cooking action started (10s required)
  };
}

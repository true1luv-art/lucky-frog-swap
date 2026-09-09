/**
 * lib/modules/players/types.server.ts
 *
 * Pure TypeScript types for the `players` domain.
 * No mongoose runtime code — only interfaces live here.
 * Consumed by model.server.ts and any external code that needs the shape
 * without importing the Mongoose model.
 */

import type { Document } from "mongoose";
import type { PlayerSkills, PlayerStats } from "@/shared/types/players";

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface IPlayer extends Document {
  wallet: string;
  username?: string;

  /** Persisted in-game LFRG balance, separate from the on-chain wallet balance. */
  lfrg: number;
  charm: number;
  /**
   * Cumulative LFRG burned to the treasury via the Stash mechanic. §C2
   * Boosts luck + dodge permanently (via computeStashBonus). Permanent and
   * never decreases.
   */
  stash: number;

  stats: PlayerStats;

  // §C4 — Player XP / level removed ("No Player Level", §5.13). Only individual
  // skill levels (player.skills) and frog levels remain as progression.

  registrationTime: number;
  referrer?: string;

  /**
   * Embedded skill XP totals. §2.1-C (Phase 2 / Sprint 2.1)
   * Derive level via `getSkillLevel(skills.farming)` from shared/data/farming.ts.
   * Each skill is independent and progresses only through its own activity.
   */
  skills: PlayerSkills;
}

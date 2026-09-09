/**
 * lib/utils/reputation.ts
 *
 * Rank thresholds and helper for the Reputation Points system. §13
 *
 * Rank names and thresholds match the reference table in the revamp plan.
 * No game mechanic is gated by rank — it is purely cosmetic.
 */

export interface RankInfo {
  rank:     string;
  /** Total rep required to enter the NEXT rank (Infinity for the final rank). */
  next:     number;
  /** 0–1 progress toward the next rank threshold. */
  progress: number;
}

export interface RankEntry {
  name:      string;
  threshold: number;
}

const RANKS: RankEntry[] = [
  { name: "Newcomer",   threshold: 0      },
  { name: "Farmhand",   threshold: 500    },
  { name: "Settler",    threshold: 1_500  },
  { name: "Cultivator", threshold: 4_000  },
  { name: "Artisan",    threshold: 10_000 },
  { name: "Elder",      threshold: 25_000 },
  { name: "Legend",     threshold: 60_000 },
];

/**
 * Returns the rank name, the next threshold, and the fractional progress
 * toward that threshold for a given reputation total.
 *
 * @example
 *   getRank(0)      // { rank: "Newcomer",   next: 500,    progress: 0    }
 *   getRank(250)    // { rank: "Newcomer",   next: 500,    progress: 0.5  }
 *   getRank(60_000) // { rank: "Legend",     next: Infinity, progress: 1 }
 */
export function getRank(reputationPoints: number): RankInfo {
  const rep = Math.max(0, reputationPoints);

  // Walk from the highest rank down to find the current bracket.
  for (let i = RANKS.length - 1; i >= 0; i--) {
    const current = RANKS[i];
    if (rep >= current.threshold) {
      const next = RANKS[i + 1];

      if (!next) {
        // Already at the maximum rank.
        return { rank: current.name, next: Infinity, progress: 1 };
      }

      const span     = next.threshold - current.threshold;
      const earned   = rep - current.threshold;
      const progress = span > 0 ? Math.min(1, earned / span) : 1;

      return { rank: current.name, next: next.threshold, progress };
    }
  }

  // Fallback (rep < 0 after Math.max guard should not reach here).
  return { rank: RANKS[0].name, next: RANKS[1].threshold, progress: 0 };
}

/** All rank entries in ascending order — useful for UI rank list. */
export const ALL_RANKS: Readonly<RankEntry[]> = RANKS;

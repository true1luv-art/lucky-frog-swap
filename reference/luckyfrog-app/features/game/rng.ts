/**
 * features/game/rng.ts
 *
 * Seeded pseudo-random number generator helpers.
 * Ported from Mythoria lib/rng-helpers.ts — pure functions, isomorphic.
 *
 * Usage:
 *   const rng = seededRng(`${playerId}@${Date.now()}@${slot}@${tier}`);
 *   const stats = rollEquipmentStats(tier, rng);
 */

/**
 * FNV-1a hash — maps an arbitrary string to an unsigned 32-bit integer seed.
 * Deterministic: same input always produces the same seed.
 */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mulberry32 PRNG — returns a stateful `() => number` generator in [0, 1).
 * Extremely fast, good statistical quality for game use cases.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convenience wrapper — create a seeded RNG from a seed string in one call.
 *
 * @param seedStr - Any string unique to the craft operation, e.g.
 *   `${playerId}@${timestamp}@${slot}@${tier}`
 * @returns A `() => number` generator in [0, 1) using mulberry32.
 */
export function seededRng(seedStr: string): () => number {
  return mulberry32(seedFromString(seedStr));
}

/**
 * Picks a random element from an array using the supplied RNG.
 */
export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

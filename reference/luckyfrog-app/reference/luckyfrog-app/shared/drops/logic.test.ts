import { describe, it, expect } from "vitest";
import {
  rollDrop,
  computeCritFromCharm,
  computeFrogmentDrop,
} from "./logic";
import { MAX_CHARM, MAX_CRIT_BONUS } from "@/shared/data/stats";

// ---------------------------------------------------------------------------
// computeCritFromCharm
// ---------------------------------------------------------------------------

describe("computeCritFromCharm", () => {
  it("returns 0 crit at 0 charm", () => {
    expect(computeCritFromCharm(0)).toBe(0);
  });

  it("returns the top table tier (~12.56%) at MAX_CHARM (1M)", () => {
    // §C1: crit now comes from the CHARM_CRIT_TABLE stepped lookup.
    expect(computeCritFromCharm(MAX_CHARM)).toBeCloseTo(12.56, 2);
  });

  it("returns a value between half and the reference max at the midpoint", () => {
    const mid = computeCritFromCharm(MAX_CHARM / 2);
    expect(mid).toBeGreaterThan(MAX_CRIT_BONUS * 0.5);
    expect(mid).toBeLessThan(MAX_CRIT_BONUS);
  });

  it("clamps input at MAX_CHARM — values above MAX_CHARM match MAX_CHARM", () => {
    expect(computeCritFromCharm(MAX_CHARM * 2)).toBeCloseTo(computeCritFromCharm(MAX_CHARM), 10);
    expect(computeCritFromCharm(MAX_CHARM * 2)).toBeLessThan(MAX_CRIT_BONUS);
  });

  it("is monotonically increasing across table breakpoints", () => {
    const vals = [0, 10_000, 100_000, 500_000, MAX_CHARM].map(computeCritFromCharm);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
    }
  });
});

// Stash bonus (computeStashBonus) is covered in ./stash-bonus.test.ts. §C2

// ---------------------------------------------------------------------------
// computeFrogmentDrop
// ---------------------------------------------------------------------------

describe("computeFrogmentDrop", () => {
  it("returns a positive amount (no rarity field)", () => {
    const { amount } = computeFrogmentDrop(20, "frogment-test");
    expect(amount).toBeGreaterThan(0);
    // No rarity field on the result
    expect((computeFrogmentDrop(20, "frogment-test") as Record<string, unknown>).rarity).toBeUndefined();
  });

  it("is deterministic for the same seed", () => {
    const a = computeFrogmentDrop(30, "seed-abc");
    const b = computeFrogmentDrop(30, "seed-abc");
    expect(a).toEqual(b);
  });

  it("higher luck produces same or larger amounts on average", () => {
    const lowLuck  = Array.from({ length: 50 }, (_, i) => computeFrogmentDrop(0,   `luck-low-${i}`).amount);
    const highLuck = Array.from({ length: 50 }, (_, i) => computeFrogmentDrop(100, `luck-high-${i}`).amount);
    const avgLow  = lowLuck.reduce((s, v) => s + v, 0) / lowLuck.length;
    const avgHigh = highLuck.reduce((s, v) => s + v, 0) / highLuck.length;
    expect(avgHigh).toBeGreaterThanOrEqual(avgLow);
  });
});

// ---------------------------------------------------------------------------
// rollDrop — reproducibility
// ---------------------------------------------------------------------------

describe("rollDrop", () => {
  it("returns the same result for the same seed (reproducibility)", () => {
    const a = rollDrop(30, 10, "wallet-abc:1700000000000");
    const b = rollDrop(30, 10, "wallet-abc:1700000000000");
    expect(a).toEqual(b);
  });

  it("returns different results for different seeds", () => {
    const pairs = [
      ["alpha-wallet:1000000000000", "beta-wallet:9999999999999"],
      ["player-A:1234567890000", "player-Z:9876543210000"],
      ["seed-foo:1111111111111", "seed-bar:8888888888888"],
    ];
    const anyDiffer = pairs.some(([s1, s2]) => {
      const a = rollDrop(30, 10, s1);
      const b = rollDrop(30, 10, s2);
      return JSON.stringify(a) !== JSON.stringify(b);
    });
    expect(anyDiffer).toBe(true);
  });

  it("always returns a Frogment reward", () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      rollDrop(0, 0, `frogment-seed-${i}`),
    );

    expect(results.every((result) => result.kind === "frogment")).toBe(true);
    expect(results.every((result) => result.amount > 0)).toBe(true);
  });

  it("marks and doubles critical Frogment rewards", () => {
    for (let i = 0; i < 20; i++) {
      const seed = `crit-test-seed-${i}`;
      const normal = rollDrop(5, 0, seed);
      const critical = rollDrop(5, 100, seed);

      expect(critical.crit).toBe(true);
      expect(critical.amount).toBe(normal.amount * 2);
    }
  });
});

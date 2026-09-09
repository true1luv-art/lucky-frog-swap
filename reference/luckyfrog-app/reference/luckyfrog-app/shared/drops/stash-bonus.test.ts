/**
 * Stash Bonus unit tests. §C2 (legacy-cleanup-fix-plan)
 *
 * Verifies that computeStashBonus() produces correct luck and dodge values
 * for the stepped stash tables. Replaces the deleted hold-bonus.test.ts —
 * the threshold now means "minStash burned to treasury" instead of "minLFRG
 * held", and the input is the permanent, cumulative player.stash counter.
 *
 * Table verification: each entry in STASH_LUCK_TABLE and STASH_DODGE_TABLE
 * is confirmed to produce the correct bonus at its threshold.
 */

import { describe, it, expect } from "vitest";
import { computeStashBonus } from "./logic";
import {
  STASH_LUCK_TABLE,
  STASH_DODGE_TABLE,
  MAX_STASH,
} from "@/shared/data/stats";

// ---------------------------------------------------------------------------
// Below the first tier — no bonus
// ---------------------------------------------------------------------------

describe("computeStashBonus — below first tier", () => {
  it("returns zero luck and dodge when stash is 0", () => {
    const bonus = computeStashBonus(0);
    expect(bonus.luck).toBe(0);
    expect(bonus.dodge).toBe(0);
  });

  it("returns zero luck and dodge just below the first tier (499 stash)", () => {
    const bonus = computeStashBonus(499);
    expect(bonus.luck).toBe(0);
    expect(bonus.dodge).toBe(0);
  });

  it("clamps negative stash to zero", () => {
    const bonus = computeStashBonus(-100);
    expect(bonus.luck).toBe(0);
    expect(bonus.dodge).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Luck table verification
// ---------------------------------------------------------------------------

describe("computeStashBonus — luck values match STASH_LUCK_TABLE", () => {
  it.each(STASH_LUCK_TABLE)(
    "stash >= %i → luck = %f",
    (minStash, expectedLuck) => {
      const bonus = computeStashBonus(minStash);
      expect(bonus.luck).toBeCloseTo(expectedLuck, 3);
    },
  );

  it("luck at exactly 500 stash (first tier) → 5.078", () => {
    expect(computeStashBonus(500).luck).toBeCloseTo(5.078, 3);
  });

  it("luck at 150,000 stash stays at the 100,000 tier value (8.041) until 250,000", () => {
    expect(computeStashBonus(150_000).luck).toBeCloseTo(8.041, 3);
  });

  it("luck at MAX_STASH (1,000,000) → 8.727", () => {
    expect(computeStashBonus(MAX_STASH).luck).toBeCloseTo(8.727, 3);
  });

  it("luck does not increase beyond MAX_STASH (cap enforced)", () => {
    const atCap = computeStashBonus(MAX_STASH).luck;
    const aboveCap = computeStashBonus(MAX_STASH * 5).luck;
    expect(atCap).toBeCloseTo(aboveCap, 3);
  });
});

// ---------------------------------------------------------------------------
// Dodge table verification
// ---------------------------------------------------------------------------

describe("computeStashBonus — dodge values match STASH_DODGE_TABLE", () => {
  it.each(STASH_DODGE_TABLE)(
    "stash >= %i → dodge = %f",
    (minStash, expectedDodge) => {
      const bonus = computeStashBonus(minStash);
      expect(bonus.dodge).toBeCloseTo(expectedDodge, 3);
    },
  );

  it("dodge at exactly 500 stash (first tier) → 8.997", () => {
    expect(computeStashBonus(500).dodge).toBeCloseTo(8.997, 3);
  });

  it("dodge at MAX_STASH (1,000,000) → 15.664", () => {
    expect(computeStashBonus(MAX_STASH).dodge).toBeCloseTo(15.664, 3);
  });

  it("dodge does not increase beyond MAX_STASH (cap enforced)", () => {
    const atCap = computeStashBonus(MAX_STASH).dodge;
    const aboveCap = computeStashBonus(MAX_STASH * 10).dodge;
    expect(atCap).toBeCloseTo(aboveCap, 3);
  });
});

// ---------------------------------------------------------------------------
// Stepped behaviour — values are NOT interpolated, they snap to tiers
// ---------------------------------------------------------------------------

describe("computeStashBonus — stepped (not interpolated)", () => {
  it("stash of 999 uses the 500 tier, not the 1,000 tier", () => {
    const at999 = computeStashBonus(999);
    const at500 = computeStashBonus(500);
    expect(at999.luck).toBeCloseTo(at500.luck, 3);
    expect(at999.dodge).toBeCloseTo(at500.dodge, 3);
  });

  it("stash of 1,001 uses the 1,000 tier", () => {
    const result = computeStashBonus(1_001);
    expect(result.luck).toBeCloseTo(5.078, 3);
    expect(result.dodge).toBeCloseTo(9.000, 3);
  });
});

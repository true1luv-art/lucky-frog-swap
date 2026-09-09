import { describe, expect, it } from "vitest";
import {
  HALVING_SCHEDULE,
  LFRG_EMISSION_ALLOCATION,
  getCurrentHalvingStep,
  getEmissionMultiplier,
  getEmissionProgress,
  getHalvingStage,
  getNextHalvingThreshold,
} from "./halving";

describe("LFRG emission halving", () => {
  it.each([
    [0, 0, 1],
    [19_999_999, 0, 1],
    [20_000_000, 1, 0.5],
    [39_999_999, 1, 0.5],
    [40_000_000, 2, 0.25],
    [59_999_999, 2, 0.25],
    [60_000_000, 3, 0.125],
    [79_999_999, 3, 0.125],
    [80_000_000, 4, 0.0625],
    [100_000_000, 4, 0.0625],
    [120_000_000, 4, 0.0625],
  ])("derives %,d as stage %d with multiplier %d", (emitted, stage, multiplier) => {
    expect(getHalvingStage(emitted)).toBe(stage);
    expect(getEmissionMultiplier(emitted)).toBe(multiplier);
    expect(getCurrentHalvingStep(emitted).stage).toBe(stage);
  });

  it.each([
    [0, 20_000_000],
    [20_000_000, 40_000_000],
    [40_000_000, 60_000_000],
    [60_000_000, 80_000_000],
    [80_000_000, null],
    [100_000_000, null],
  ])("returns the next multiplier milestone for %,d", (emitted, next) => {
    expect(getNextHalvingThreshold(emitted)).toBe(next);
  });

  it("reports allocation and tranche progress without going negative", () => {
    expect(getEmissionProgress(50_000_000)).toMatchObject({
      allocation: LFRG_EMISSION_ALLOCATION,
      allocationRemaining: 50_000_000,
      allocationProgress: 0.5,
      trancheEmitted: 10_000_000,
      trancheRemaining: 10_000_000,
      trancheProgress: 0.5,
    });
    expect(getEmissionProgress(120_000_000).allocationRemaining).toBe(0);
  });

  it("contains five successively halved emission bands", () => {
    expect(HALVING_SCHEDULE).toHaveLength(5);
    expect(HALVING_SCHEDULE.map((step) => step.emissionMultiplier)).toEqual([
      1, 0.5, 0.25, 0.125, 0.0625,
    ]);
  });
});

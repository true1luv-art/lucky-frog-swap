import { describe, expect, it } from "vitest";
import {
  getReducedDuration,
  getRoundedReducedDuration,
  getSnapshotTimestamp,
} from "./boosts";

describe("timer snapshot helpers", () => {
  it("applies reductions without allowing negative durations", () => {
    expect(getReducedDuration(1_000, 0)).toBe(1_000);
    expect(getReducedDuration(1_000, 0.1)).toBe(900);
    expect(getReducedDuration(1_000, 2)).toBe(0);
  });

  it("rounds persisted durations consistently", () => {
    expect(getRoundedReducedDuration(65, 0.1)).toBe(59);
  });

  it("encodes a reduced duration into an immutable start timestamp", () => {
    const createdAt = 10_000;
    const snapshot = getSnapshotTimestamp(createdAt, 1_000, 0.1);
    expect(snapshot).toBe(9_900);
    expect(createdAt + 900 - snapshot).toBe(1_000);
  });
});

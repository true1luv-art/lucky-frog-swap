import { describe, expect, it } from "vitest";
import { computeQuestPower, computeQuestPowerSync, getBonusRolls } from "./power";

describe("quest power", () => {
  it("floors luck and supports missing stats", async () => {
    expect(computeQuestPowerSync(41.9)).toBe(41);
    expect(await computeQuestPower({ stats: { luck: 20.8 } })).toBe(20);
    expect(await computeQuestPower({})).toBe(0);
  });

  it.each([
    [0, 0],
    [20, 0],
    [21, 1],
    [41, 2],
    [61, 3],
    [81, 4],
    [101, 5],
  ])("maps power %i to %i bonus rolls", (power, bonus) => {
    expect(getBonusRolls(power)).toBe(bonus);
  });
});

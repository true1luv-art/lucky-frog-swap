import { describe, expect, it } from "vitest";
import {
  getCollectibleBonuses,
  mergeSkillAndCollectibleBonuses,
  normalizeOwnedCollectibles,
  ownsCollectible,
  recomputeOwnedBonuses,
} from "./collectibles";
import { COLLECTIBLE_NAMES } from "@/shared/types/gameplay/collectibles";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

describe("collectible ownership helpers", () => {
  it("canonicalizes, deduplicates, and rejects unknown ownership names", () => {
    expect(
      normalizeOwnedCollectibles([
        "Husbandry Bell",
        "unknown",
        "Harvest Scarecrow",
        "Husbandry Bell",
      ]),
    ).toEqual(["Harvest Scarecrow", "Husbandry Bell"]);
  });

  it("reports ownership as a boolean regardless of duplicate copies", () => {
    const owned = ["Forester's Totem", "Forester's Totem"];
    expect(ownsCollectible(owned, "Forester's Totem")).toBe(true);
    expect(ownsCollectible(owned, "Fisher's Shrine")).toBe(false);
  });

  it("returns no bonus for zero copies and exactly 10% for duplicate copies", () => {
    expect(getCollectibleBonuses([])).toEqual({});
    expect(
      getCollectibleBonuses([
        "Harvest Scarecrow",
        "Harvest Scarecrow",
        "Harvest Scarecrow",
      ]),
    ).toEqual({ cropSpeed: 0.1 });
  });

  it("maps all six collectibles to their canonical SkillBonus keys", () => {
    expect(getCollectibleBonuses(COLLECTIBLE_NAMES)).toEqual({
      cropSpeed: 0.1,
      woodRecovery: 0.1,
      fishSpeed: 0.1,
      oreRecovery: 0.1,
      cookingSpeed: 0.1,
      produceSpeed: 0.1,
    });
  });

  it("retains collectible reductions when skill bonuses are recomputed", () => {
    const bonus = recomputeOwnedBonuses(
      { farming: 0, woodcutting: 0, mining: 0, fishing: 0, cooking: 0, husbandry: 0, combat: 0 },
      ["Harvest Scarecrow", "Harvest Scarecrow"],
    );
    expect(bonus.cropSpeed).toBe(0.1);
  });

  it("merges skill and collectible reductions without mutating either input", () => {
    const skillBonus = { ...INITIAL_BONUS, cropSpeed: 0.05, woodYield: 0.2 };
    const collectibleBonus = { cropSpeed: 0.1 };

    const merged = mergeSkillAndCollectibleBonuses(skillBonus, collectibleBonus);
    expect(merged.cropSpeed).toBeCloseTo(0.15);
    expect(merged.woodYield).toBe(0.2);
    expect(skillBonus.cropSpeed).toBe(0.05);
    expect(collectibleBonus.cropSpeed).toBe(0.1);
  });
});

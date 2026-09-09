import { describe, expect, it } from "vitest";
import type { EmbeddedQuest } from "@/shared/types/quests";
import { rollFrogments, rollFromAmountTable } from "./reward-roll";

const quest: EmbeddedQuest = {
  id: "quest-1",
  category: "farming",
  difficulty: "easy",
  status: "active",
  objective: { resource: "Potato", required: 20 },
  rewards: { guaranteedShards: [], skillXp: 50, baseRolls: 2 },
  generatedAt: 0,
  expiresAt: 1,
};

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

describe("reward rolls", () => {
  it("draws from weighted table boundaries", () => {
    const table = [
      { amount: 3, weight: 40 },
      { amount: 8, weight: 60 },
    ];
    expect(rollFromAmountTable(table, () => 0.39)).toBe(3);
    expect(rollFromAmountTable(table, () => 0.41)).toBe(8);
  });

  it("adds bonus rolls from player luck", () => {
    const results = rollFrogments(quest, { luck: 41 }, () => 0.5);
    expect(results).toHaveLength(4);
    expect(results.map((result) => result.roll)).toEqual([1, 2, 3, 4]);
  });

  it("multiplies jackpot outcomes", () => {
    const results = rollFrogments(quest, { luck: 0 }, sequence([0, 0, 0, 1]));
    expect(results[0]).toEqual({ roll: 1, amount: 9, jackpot: true });
    expect(results[1]).toEqual({ roll: 2, amount: 3, jackpot: false });
  });
});

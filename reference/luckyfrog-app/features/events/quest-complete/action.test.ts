import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeQuest } from "./action";

vi.mock("@/lib/modules/items/model.server", () => ({
  ItemModel: { updateOne: vi.fn().mockResolvedValue({}) },
}));

vi.mock("@/lib/modules/items/repository.server", () => ({
  getInventory: vi.fn(),
}));

vi.mock("@/lib/modules/players/model.server", () => ({
  PlayerModel: { findOneAndUpdate: vi.fn() },
}));

vi.mock("@/lib/modules/farms/repository.server", () => ({
  getFarm:             vi.fn(),
  completeQuestOnFarm: vi.fn(),
}));

vi.mock("@/lib/modules/game-stats/repository.server", () => ({
  incrementQuestsCompleted: vi.fn().mockResolvedValue(undefined),
}));


import { getFarm, completeQuestOnFarm } from "@/lib/modules/farms/repository.server";
import { getInventory }                  from "@/lib/modules/items/repository.server";
import { PlayerModel }                   from "@/lib/modules/players/model.server";

const PLAYER_ID = "0xplayer00000000000000000000000000000001";

const ACTIVE_QUEST = {
  id:         "q1",
  category:   "farming",
  difficulty: "normal" as const,
  status:     "active" as const,
  objective:  { resource: "Potato", required: 5 },
  rewards:    { skillXp: 20, goldReward: 1, seedReward: "Radish Seed" },
  generatedAt: Date.now() - 1000,
  expiresAt:   Date.now() + 86_400_000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("completeQuest", () => {
  it("completes a quest and returns rewards", async () => {
    vi.mocked(getFarm).mockResolvedValue({ quests: { daily: [ACTIVE_QUEST] } } as never);
    vi.mocked(getInventory).mockResolvedValue({ items: { Potato: 10 } } as never);
    vi.mocked(PlayerModel.findOneAndUpdate).mockResolvedValue(null as never);
    vi.mocked(completeQuestOnFarm).mockResolvedValue(true as never);

    const result = await completeQuest(PLAYER_ID, "q1");

    expect(result.skillXp).toBe(20);
    expect(result.goldAwarded).toBeGreaterThanOrEqual(1);
    expect(result.goldAwarded).toBeLessThanOrEqual(2);
    expect(result.seedAwarded).toBe("Radish Seed");
  });

  it("throws when farm is not found", async () => {
    vi.mocked(getFarm).mockResolvedValue(null as never);

    await expect(completeQuest(PLAYER_ID, "q1")).rejects.toThrow("Farm not found");
  });

  it("throws when quest id does not match any quest", async () => {
    vi.mocked(getFarm).mockResolvedValue({ quests: { daily: [ACTIVE_QUEST] } } as never);

    await expect(completeQuest(PLAYER_ID, "bad-id")).rejects.toThrow("Quest not found");
  });

  it("throws when quest is already completed", async () => {
    const done = { ...ACTIVE_QUEST, status: "completed" as const };
    vi.mocked(getFarm).mockResolvedValue({ quests: { daily: [done] } } as never);

    await expect(completeQuest(PLAYER_ID, "q1")).rejects.toThrow("completed");
  });

  it("throws when player has insufficient items", async () => {
    vi.mocked(getFarm).mockResolvedValue({ quests: { daily: [ACTIVE_QUEST] } } as never);
    vi.mocked(getInventory).mockResolvedValue({ items: { Potato: 2 } } as never);

    await expect(completeQuest(PLAYER_ID, "q1")).rejects.toThrow("Insufficient");
  });
});

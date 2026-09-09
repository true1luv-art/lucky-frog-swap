/**
 * lib/events/quest-complete/action.ts
 *
 * Quest completion handler. §fold-quests / §3.4-A
 *
 * Flow:
 *   1. Load the player's farm and look up the quest by id string.
 *   2. Validate: quest must exist, belong to this player, and be active.
 *   3. Validate inventory — player must have the full required quantity.
 *   4. Atomic ops:
 *        a. Deduct required resources from inventory.
 *        b. Increment skill XP for the quest's category.
 *        c. Award Gold and optional seed reward.
 *   5. Persist quest completion on the farm document.
 *
 * No rolls, no luck, no stat-based modifiers — rewards are flat and deterministic.
 */

import { ItemModel }                from "@/lib/modules/items/model.server";
import { getInventory }             from "@/lib/modules/items/repository.server";
import { PlayerModel }              from "@/lib/modules/players/model.server";
import { findPlayerByWallet }       from "@/lib/modules/players/repository.server";
import { incrementQuestsCompleted } from "@/lib/modules/game-stats/repository.server";

import type { EmbeddedQuest }       from "@/features/types/quests";
import { rollQuestGoldReward }      from "@/features/game/gold";

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

class QuestError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code   = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface QuestCompleteResult {
  quest:        EmbeddedQuest;
  skillXp:      number;
  /** Gold awarded on this completion. Always >= 1 for quests with a goldReward tier. */
  goldAwarded:  number;
  /** Quest-exclusive seed added to inventory, if any. e.g. "Radish Seed" */
  seedAwarded?: string;
}

// ---------------------------------------------------------------------------
// completeQuest
// ---------------------------------------------------------------------------

export async function completeQuest(
  playerId: string,
  questId:  string,
): Promise<QuestCompleteResult> {

  // 1. Fetch player and locate quest
  const player = await findPlayerByWallet(playerId);
  if (!player) throw new QuestError("Player not found.", "PLAYER_NOT_FOUND", 404);

  const allEmbedded = (player.quests?.daily ?? []) as EmbeddedQuest[];

  const quest = allEmbedded.find((q) => q.id === questId);
  if (!quest) throw new QuestError("Quest not found for this player.", "QUEST_NOT_FOUND", 404);

  // 2. Validate status
  if (quest.status !== "active") {
    throw new QuestError(`Quest is ${quest.status} — cannot complete.`, "QUEST_NOT_ACTIVE", 409);
  }
  if (Date.now() > quest.expiresAt) {
    throw new QuestError("Quest has expired.", "QUEST_NOT_ACTIVE", 409);
  }

  // 3. Validate inventory
  const inventory = await getInventory(playerId);
  const held = (inventory?.items as Record<string, number> | undefined)?.[quest.objective.resource] ?? 0;
  if (held < quest.objective.required) {
    throw new QuestError(
      `Insufficient ${quest.objective.resource}. Need ${quest.objective.required}, have ${held}.`,
      "INSUFFICIENT_ITEMS",
    );
  }

  // 4a. Deduct required resource
  await ItemModel.updateOne(
    { owner: playerId, item: quest.objective.resource },
    { $inc: { amount: -quest.objective.required } },
    { upsert: false },
  );

  // 4b. Award Skill XP + Gold
  const skillXp    = quest.rewards.skillXp   ?? 0;
  const goldTier   = quest.rewards.goldReward != null ? quest.difficulty : undefined;
  const goldAmount = goldTier ? rollQuestGoldReward(goldTier) : 0;
  const seedReward = quest.rewards.seedReward;

  await PlayerModel.findOneAndUpdate(
    { wallet: playerId },
    { $inc: { [`skills.${quest.category}`]: skillXp > 0 ? skillXp : 0 } },
  );

  // 4c. Award seed reward
  if (seedReward) {
    await ItemModel.updateOne(
      { owner: playerId, item: seedReward },
      { $inc: { amount: 1 }, $setOnInsert: { type: "seed", market: null } },
      { upsert: true },
    );
  }

  // 5. Persist completion on player document (update quest status and completedAt)
  const result = await PlayerModel.updateOne(
    {
      wallet: playerId,
      "quests.daily": { $elemMatch: { id: questId, status: "active" } },
    },
    {
      $set: {
        "quests.daily.$[elem].status":      "completed",
        "quests.daily.$[elem].completedAt": Date.now(),
      },
    },
    {
      arrayFilters: [{ "elem.id": questId }],
    },
  );
  
  if (result.modifiedCount === 0) {
    throw new QuestError("Quest was already completed by a concurrent request.", "CONCURRENT_COMPLETE", 409);
  }

  // 6. Increment game-stats counter (fire-and-forget)
  incrementQuestsCompleted("daily").catch((err) => {
    console.error("[quest-complete] Failed to increment quest counter (non-fatal):", err);
  });

  return {
    quest,
    skillXp,
    goldAwarded: goldAmount,
    seedAwarded: seedReward,
  };
}

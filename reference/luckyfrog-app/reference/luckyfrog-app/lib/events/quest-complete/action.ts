/**
 * lib/events/quest-complete/action.ts
 *
 * Quest completion handler. §fold-quests / §3.4-A
 *
 * Completes a single embedded quest (daily or weekly) on the player's farm.
 * Village orders have been removed. §fold-quests design decision.
 *
 * Flow:
 *   1. Load the player's farm and look up the quest by id string.
 *   2. Validate: quest must exist, belong to this player, and be active.
 *   3. Validate inventory — player must have the full required quantity.
 *   4. Atomic ops (no multi-doc session needed — each is a single doc write):
 *        a. Deduct required resources from inventory.
 *        b. Credit guaranteed shards to inventory.
 *        c. Increment skill XP for the quest's category.
 *   5. Process Egg Shard Reward Rolls (non-critical, outside any transaction).
 *   6. Persist quest completion + roll results on the farm document.
 *
 * Error codes (thrown as Error with .code property):
 *   QUEST_NOT_FOUND      — quest does not exist on this farm.
 *   QUEST_NOT_ACTIVE     — quest is expired or already completed.
 *   INSUFFICIENT_ITEMS   — player lacks the required resource quantity.
 *   CONCURRENT_COMPLETE  — farm update did not match (race guard).
 *
 * Reference: docs/implementation_plans/phase-03-quest-system.md §3.4-A
 */

import mongoose                         from "mongoose";
import { InventoryModel }               from "@/lib/modules/inventories/model.server";
import { getInventory }                 from "@/lib/modules/inventories/repository.server";
import { PlayerModel }                  from "@/lib/modules/players/model.server";
import { findPlayerByWallet }           from "@/lib/modules/players/repository.server";
import { getFarm }                      from "@/lib/modules/farms/repository.server";
import { completeQuestOnFarm }          from "@/lib/modules/farms/repository.server";
import type { EmbeddedQuest, FrogmentRollResult } from "@/shared/types/quests";
import { processFrogmentRolls }         from "@/lib/modules/farms/reward-roll.server";
import { incrementQuestsCompleted }     from "@/lib/modules/game-stats/repository.server";

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
  quest:      EmbeddedQuest;
  guaranteed: EmbeddedQuest["rewards"];
  rolls:      FrogmentRollResult[];
  totalRolls: number;
}

// ---------------------------------------------------------------------------
// §3.4-A — completeQuest
// ---------------------------------------------------------------------------

/**
 * Completes an embedded quest for a player.
 *
 * @param playerId - Wallet address.
 * @param questId  - The embedded quest's `id` string (nanoid).
 * @returns        - Completion result with guaranteed rewards and all roll results.
 * @throws         - QuestError for all validation failures.
 */
export async function completeQuest(
  playerId: string,
  questId:  string,
): Promise<QuestCompleteResult> {

  // ── 1. Fetch farm and locate quest ────────────────────────────────────────

  const farm = await getFarm(playerId);

  if (!farm) {
    throw new QuestError("Farm not found.", "QUEST_NOT_FOUND", 404);
  }

  // Search both daily and weekly arrays.
  const allEmbedded: Array<{ quest: EmbeddedQuest; type: "daily" | "weekly" }> = [
    ...(farm.quests?.daily  ?? []).map((q) => ({ quest: q, type: "daily"  as const })),
    ...(farm.quests?.weekly ?? []).map((q) => ({ quest: q, type: "weekly" as const })),
  ];

  const found = allEmbedded.find((e) => e.quest.id === questId);

  if (!found) {
    throw new QuestError(
      "Quest not found on this farm.",
      "QUEST_NOT_FOUND",
      404,
    );
  }

  const { quest, type: questType } = found;

  // ── 2. Validate status ────────────────────────────────────────────────────

  if (quest.status !== "active") {
    throw new QuestError(
      `Quest is ${quest.status} — cannot complete.`,
      "QUEST_NOT_ACTIVE",
      409,
    );
  }

  if (Date.now() > quest.expiresAt) {
    throw new QuestError(
      "Quest has expired.",
      "QUEST_NOT_ACTIVE",
      409,
    );
  }

  // ── 3. Validate inventory ─────────────────────────────────────────────────

  const inventory = await getInventory(playerId);
  const held      = (inventory?.items as Record<string, number> | undefined)?.[quest.objective.resource] ?? 0;

  if (held < quest.objective.required) {
    throw new QuestError(
      `Insufficient ${quest.objective.resource}. Need ${quest.objective.required}, have ${held}.`,
      "INSUFFICIENT_ITEMS",
    );
  }

  // ── 4. Atomic inventory + player writes (single-document ops — no session) ─

  // a. Deduct required resource.
  await InventoryModel.updateOne(
    { owner: playerId, item: quest.objective.resource },
    { $inc: { amount: -quest.objective.required } },
    { upsert: false },
  );

  // b. Credit guaranteed frogments.
  const guaranteedTotal = (quest.rewards.guaranteedShards ?? []).reduce(
    (sum, { amount }) => sum + amount,
    0,
  );
  if (guaranteedTotal > 0) {
    await InventoryModel.updateOne(
      { owner: playerId, item: "frogment" },
      {
        $inc: { amount: guaranteedTotal },
        $setOnInsert: { owner: playerId, item: "frogment", market: null },
      },
      { upsert: true },
    );
  }

  // c. Increment skill XP.
  if (quest.rewards.skillXp > 0) {
    await PlayerModel.findOneAndUpdate(
      { wallet: playerId },
      { $inc: { [`skills.${quest.category}`]: quest.rewards.skillXp } },
    );
  }

  // ── 5. Frog Shard Reward Rolls (non-critical) ─────────────────────────────

  const player = await findPlayerByWallet(playerId);
  let rolls: FrogmentRollResult[] = [];

  if (player) {
    try {
      rolls = await processFrogmentRolls(playerId, quest, player);
    } catch (rollErr) {
      console.error("[quest-complete] Roll processing failed (non-fatal):", rollErr);
    }
  }

  // ── 6. Persist completion on farm document ────────────────────────────────

  const completed = await completeQuestOnFarm(playerId, questId, questType, rolls);

  if (!completed) {
    // Another concurrent request claimed this quest just before us.
    throw new QuestError(
      "Quest was already completed by a concurrent request.",
      "CONCURRENT_COMPLETE",
      409,
    );
  }

  // ── 7. Increment game-stats quest counter (fire-and-forget) ──────────────

  incrementQuestsCompleted(questType).catch((err) => {
    console.error("[quest-complete] Failed to increment quest counter (non-fatal):", err);
  });

  return {
    quest,
    guaranteed: quest.rewards,
    rolls,
    totalRolls: rolls.length,
  };
}

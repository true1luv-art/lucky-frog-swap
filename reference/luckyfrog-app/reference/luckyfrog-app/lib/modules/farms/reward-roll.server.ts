import { addItems } from "@/lib/modules/inventories/repository.server";
import type { IPlayer } from "@/lib/modules/players/types.server";
import { rollFrogments } from "@/shared/quests/reward-roll";
import type { EmbeddedQuest, FrogmentRollResult } from "@/shared/types/quests";

export async function creditGuaranteedShards(
  playerId: string,
  guaranteedShards: EmbeddedQuest["rewards"]["guaranteedShards"],
): Promise<void> {
  if (!guaranteedShards?.length) return;
  const total = guaranteedShards.reduce((sum, reward) => sum + reward.amount, 0);
  if (total > 0) await addItems(playerId, { frogment: total });
}

export async function processFrogmentRolls(
  playerId: string,
  quest: EmbeddedQuest,
  player: IPlayer,
): Promise<FrogmentRollResult[]> {
  const results = rollFrogments(quest, { luck: player.stats?.luck ?? 0 });
  const totalFrogments = results.reduce((sum, result) => sum + result.amount, 0);

  if (totalFrogments > 0) {
    await addItems(playerId, { frogment: totalFrogments });
  }

  return results;
}

/** @deprecated Use processFrogmentRolls. */
export const processFrogShardRolls = processFrogmentRolls;

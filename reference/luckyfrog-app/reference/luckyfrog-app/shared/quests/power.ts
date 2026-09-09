import { QUEST_POWER_BONUS_ROLLS } from "@/shared/data/quests";
import type { PlayerStats } from "@/shared/types/players";

export interface QuestPowerPlayer {
  stats?: Pick<PlayerStats, "luck"> | null;
}

/** Computes Quest Power from the player's luck stat. */
export async function computeQuestPower(player: QuestPowerPlayer): Promise<number> {
  return computeQuestPowerSync(player.stats?.luck ?? 0);
}

/** Computes Quest Power when total luck is already available. */
export function computeQuestPowerSync(totalLuck: number): number {
  return Math.floor(totalLuck);
}

/** Returns the bonus reward rolls for a Quest Power score. */
export function getBonusRolls(questPower: number): number {
  const entry = QUEST_POWER_BONUS_ROLLS.find(
    (tier) => questPower >= tier.min && questPower <= tier.max,
  );
  return entry?.bonus ?? 0;
}

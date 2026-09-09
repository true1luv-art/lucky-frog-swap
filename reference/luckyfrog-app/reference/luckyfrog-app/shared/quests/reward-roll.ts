import {
  JACKPOT_CHANCE,
  JACKPOT_MULTIPLIER,
  getFrogmentRollTable,
} from "@/shared/data/quests";
import type { FrogmentRollEntry } from "@/shared/data/quests";
import type { PlayerStats } from "@/shared/types/players";
import type { EmbeddedQuest, FrogmentRollResult } from "@/shared/types/quests";
import { computeQuestPowerSync, getBonusRolls } from "@/shared/quests/power";

export type RandomSource = () => number;

/** Selects an amount from a weighted table using a proportional draw. */
export function rollFromAmountTable(
  table: readonly FrogmentRollEntry[],
  random: RandomSource = Math.random,
): number {
  if (table.length === 0) return 0;

  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let draw = random() * totalWeight;
  for (const entry of table) {
    draw -= entry.weight;
    if (draw <= 0) return entry.amount;
  }
  return table[table.length - 1].amount;
}

/** Runs all reward-roll math without persistence or server dependencies. */
export function rollFrogments(
  quest: EmbeddedQuest,
  playerStats: Pick<PlayerStats, "luck">,
  random: RandomSource = Math.random,
): FrogmentRollResult[] {
  const questPower = computeQuestPowerSync(playerStats.luck ?? 0);
  const totalRolls = quest.rewards.baseRolls + getBonusRolls(questPower);
  const table = getFrogmentRollTable(quest.difficulty);
  const results: FrogmentRollResult[] = [];

  for (let index = 0; index < totalRolls; index += 1) {
    let amount = rollFromAmountTable(table, random);
    const jackpot = random() < JACKPOT_CHANCE;
    if (jackpot) amount *= JACKPOT_MULTIPLIER;
    results.push({ roll: index + 1, amount, jackpot });
  }

  return results;
}

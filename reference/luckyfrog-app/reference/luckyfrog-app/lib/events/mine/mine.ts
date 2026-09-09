import Decimal from "decimal.js-light";
import type { GameState, GameNode } from "@/shared/types/gameplay/game";
import { getSkillLevel, getSkillXP } from "@/shared/game/skills";
import { getOreYield, getSnapshotTimestamp, rollOreDouble } from "@/shared/game/boosts";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";
import { deductStamina, hasEnoughStamina } from "@/shared/game/stamina";
import { trackActivity } from "@/shared/game/activity";
import {
  GOLD_RECOVERY_SECONDS,
  IRON_RECOVERY_SECONDS,
  STONE_RECOVERY_SECONDS,
} from "@/shared/data/farming";
import type { ActivityName } from "@/shared/types/gameplay/achievements";

export type MineAction =
  | { type: "stone.mined"; index: number }
  | { type: "iron.mined"; index: number }
  | { type: "gold.mined"; index: number };

type MineConfig = {
  collection: "stones" | "iron" | "gold";
  item: "Stone" | "Iron" | "Gold";
  stamina: "mine_stone" | "mine_iron" | "mine_gold";
  recoverySeconds: number;
  activity: ActivityName;
};

const CONFIG: Record<MineAction["type"], MineConfig> = {
  "stone.mined": { collection: "stones", item: "Stone", stamina: "mine_stone", recoverySeconds: STONE_RECOVERY_SECONDS, activity: "Stone Mined" },
  "iron.mined": { collection: "iron", item: "Iron", stamina: "mine_iron", recoverySeconds: IRON_RECOVERY_SECONDS, activity: "Iron Mined" },
  "gold.mined": { collection: "gold", item: "Gold", stamina: "mine_gold", recoverySeconds: GOLD_RECOVERY_SECONDS, activity: "Gold Mined" },
};

export function mine(
  { state, action, createdAt = Date.now() }: {
    state: GameState;
    action: MineAction;
    createdAt?: number;
  },
): GameState {
  const config = CONFIG[action.type];
  if (!hasEnoughStamina(state.stamina.current, config.stamina)) throw new Error("Not enough stamina to mine");

  const nodes = state[config.collection] as Record<number, GameNode>;
  const rock = nodes[action.index];
  if (!rock) throw new Error("No rock");
  if (createdAt - (rock.minedAt ?? 0) <= config.recoverySeconds * 1000) throw new Error("Rock is still recovering");

  const boosted = getOreYield(rock.amount ?? 2, state.bonus);
  const drop = rollOreDouble(state.bonus) ? boosted * 2 : boosted;
  const current = new Decimal(state.inventory[config.item] ?? 0);
  const newMiningXP = state.skills.mining + getSkillXP(config.stamina);
  const oldLevel = getSkillLevel(state.skills.mining);
  const newLevel = getSkillLevel(newMiningXP);
  const newBonus = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses({ ...state.skills, mining: newMiningXP }, state.ownedCollectibles)
    : state.bonus;

  return {
    ...state,
    inventory: { ...state.inventory, [config.item]: current.add(drop) },
    [config.collection]: {
      ...nodes,
      [action.index]: {
        name: config.item,
        minedAt: getSnapshotTimestamp(
          createdAt,
          config.recoverySeconds * 1000,
          state.bonus.oreRecovery,
        ),
        amount: 2,
      },
    },
    skills: { ...state.skills, mining: newMiningXP },
    bonus: newBonus,
    stamina: { ...state.stamina, current: deductStamina(state.stamina.current, config.stamina) },
    activity: trackActivity(state.activity, config.activity, 1),
  };
}

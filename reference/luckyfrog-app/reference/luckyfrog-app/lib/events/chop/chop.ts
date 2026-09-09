import Decimal from "decimal.js-light";
import { GameState, GameNode } from "@/shared/types/gameplay/game";
import { getSkillXP, getSkillLevel } from "@/shared/game/skills";
import { getSnapshotTimestamp, getWoodYield, rollWoodDouble } from "@/shared/game/boosts";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";
import { hasEnoughStamina, deductStamina } from "@/shared/game/stamina";
import { trackActivity } from "@/shared/game/activity";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

export enum CHOP_ERRORS { NO_TREE = "No tree", STILL_GROWING = "Tree is still growing" }
export const TREE_RECOVERY_SECONDS = 15 * 60;

export function canChop(tree: GameNode, now: number = Date.now()): boolean {
  return now - (tree.choppedAt ?? 0) > TREE_RECOVERY_SECONDS * 1000;
}

export type ChopAction = { type: "tree.chopped"; index: number };
type Options = { state: GameState; action: ChopAction; createdAt?: number };

export function chop({ state, action, createdAt = Date.now() }: Options): GameState {
  if (!hasEnoughStamina(state.stamina.current, "chop_tree")) throw new Error("Not enough stamina to chop");

  const tree = state.trees[action.index];
  if (!tree)                     throw new Error(CHOP_ERRORS.NO_TREE);
  if (!canChop(tree, createdAt)) throw new Error(CHOP_ERRORS.STILL_GROWING);

  const bonus    = state.bonus ?? { ...INITIAL_BONUS };
  const boosted  = getWoodYield(tree.amount ?? 3, bonus);
  const woodDrop = rollWoodDouble(bonus) ? boosted * 2 : boosted;

  const woodAmount        = new Decimal(state.inventory.Wood || 0);
  const newWoodcuttingXP  = (state.skills.woodcutting ?? 0) + getSkillXP("chop_tree");

  const oldLevel = getSkillLevel(state.skills.woodcutting ?? 0);
  const newLevel = getSkillLevel(newWoodcuttingXP);
  const newBonus = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(
        { ...state.skills, woodcutting: newWoodcuttingXP },
        state.ownedCollectibles,
      )
    : bonus;

  return {
    ...state,
    inventory: { ...state.inventory, Wood: woodAmount.add(woodDrop) },
    trees: {
      ...state.trees,
      [action.index]: {
        name: "Wood" as const,
        choppedAt: getSnapshotTimestamp(
          createdAt,
          TREE_RECOVERY_SECONDS * 1000,
          bonus.woodRecovery,
        ),
        amount: 3,
      },
    },
    skills:    { ...state.skills, woodcutting: newWoodcuttingXP },
    bonus:     newBonus,
    stamina:   { ...state.stamina, current: deductStamina(state.stamina.current, "chop_tree") },
    activity:  trackActivity(state.activity, "Tree Chopped", 1),
  };
}

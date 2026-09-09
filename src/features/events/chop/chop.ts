import Decimal from "decimal.js-light";
import { GameState, GameNode } from "@/features/types/gameplay/game";
import { getSkillXP } from "@/features/game/skills";
import { trackMilestone } from "@/features/game/milestones";
import { CHOP_ACTION_MS } from "@/features/game/resources";
import { TOOL_SPEED_BOOST, decrementDurability } from "@/features/types/gameplay/tools";

export enum CHOP_ERRORS {
  NO_TREE       = "No tree",
  STILL_GROWING = "Tree is still growing",
  NO_AXES       = "No axes left — craft one at the Blacksmith",
}
export const TREE_RECOVERY_SECONDS = 15 * 60;

export function canChop(tree: GameNode, now: number = Date.now()): boolean {
  return now - (tree.choppedAt ?? 0) > TREE_RECOVERY_SECONDS * 1000;
}

export type ChopAction = { type: "tree.chopped"; index: number };
type Options = { state: GameState; action: ChopAction; createdAt?: number };

export function chop({ state, action, createdAt = Date.now() }: Options): GameState {
  // Find Axe in tools[]
  const axeIdx = state.tools.findIndex((t) => t.name === "Axe");
  if (axeIdx === -1) throw new Error(CHOP_ERRORS.NO_AXES);
  const axe = state.tools[axeIdx];

  // Cooldown — 5s base reduced by tier boost (used server-side; stored for reference)
  void (CHOP_ACTION_MS * (1 - TOOL_SPEED_BOOST[axe.tier]));

  // Auto-initialise: a missing entry means the node has never been chopped —
  // treat it as fresh (choppedAt = 0) rather than throwing.
  const tree: GameNode = state.trees[action.index] ?? { name: "Wood", choppedAt: 0 };
  if (!canChop(tree, createdAt)) throw new Error(CHOP_ERRORS.STILL_GROWING);

  const woodAmount       = new Decimal((state.items as Record<string, Decimal>)["Wood"] || 0);
  const newWoodcuttingXP = (state.skills.woodcutting ?? 0) + getSkillXP("chop_tree");

  // Decrement Axe durability — remove from tools[] if broken
  const decremented = decrementDurability(axe);
  const nextTools = [...state.tools];
  if (decremented === null) {
    nextTools.splice(axeIdx, 1);
  } else {
    nextTools[axeIdx] = decremented;
  }

  const nextItems = { ...state.items, Wood: woodAmount.add(1) };

  return {
    ...state,
        items: nextItems, // alias
    tools:     nextTools,
    trees: {
      ...state.trees,
      [action.index]: {
        name: "Wood" as const,
        choppedAt: createdAt,
      },
    },
    skills:     { ...state.skills, woodcutting: newWoodcuttingXP },
    milestones: trackMilestone(state.milestones, "Tree Chopped", 1),
  };
}

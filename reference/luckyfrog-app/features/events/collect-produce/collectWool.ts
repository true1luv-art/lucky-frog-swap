import Decimal from "decimal.js-light";
import { GameState } from "@/features/types/gameplay/game";
import { ANIMALS_CONFIG } from "@/features/game/animals";
import { trackMilestone } from "@/features/game/milestones";
import { getSkillXP } from "@/features/game/skills";

export type CollectWoolAction = { type: "sheep.collectWool"; index: number };
type Options = { state: GameState; action: CollectWoolAction; createdAt?: number };

export function collectWool({ state, action, createdAt = Date.now() }: Options): GameState {
  const sheepCount = state.items.Sheep ?? 0;
  if (action.index < 0 || action.index >= Number(sheepCount)) throw new Error("Sheep does not exist");

  const sheep = state.sheep[action.index];
  if (!sheep?.fedAt) throw new Error("Sheep has not been fed");
  if (createdAt - sheep.fedAt < ANIMALS_CONFIG.Sheep.produceTimeMs) throw new Error("Wool is not ready yet");

  const currentWool    = state.items.Wool ?? new Decimal(0);
  const collectXP      = getSkillXP("collect_wool");
  const newHusbandryXP = (state.skills.husbandry ?? 0) + collectXP;
  const newSkills      = { ...state.skills, husbandry: newHusbandryXP };
  const nextItems      = { ...state.items, Wool: new Decimal(currentWool).add(1) };

  return {
    ...state,
        items: nextItems, // alias
    sheep:      { ...state.sheep, [action.index]: { fedAt: undefined } },
    milestones: trackMilestone(state.milestones, "Wool Collected", 1),
    skills:     newSkills,
  };
}

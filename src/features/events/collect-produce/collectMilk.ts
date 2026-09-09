import Decimal from "decimal.js-light";
import { GameState } from "@/features/types/gameplay/game";
import { ANIMALS_CONFIG } from "@/features/game/animals";
import { trackMilestone } from "@/features/game/milestones";
import { getSkillXP } from "@/features/game/skills";

export type CollectMilkAction = { type: "cow.collectMilk"; index: number };
type Options = { state: GameState; action: CollectMilkAction; createdAt?: number };

export function collectMilk({ state, action, createdAt = Date.now() }: Options): GameState {
  const cowCount = state.items.Cow ?? 0;
  if (action.index < 0 || action.index >= Number(cowCount)) throw new Error("Cow does not exist");

  const cow = state.cows[action.index];
  if (!cow?.fedAt) throw new Error("Cow has not been fed");
  if (createdAt - cow.fedAt < ANIMALS_CONFIG.Cow.produceTimeMs) throw new Error("Milk is not ready yet");

  const currentMilk    = state.items.Milk ?? new Decimal(0);
  const collectXP      = getSkillXP("collect_milk");
  const newHusbandryXP = (state.skills.husbandry ?? 0) + collectXP;
  const newSkills      = { ...state.skills, husbandry: newHusbandryXP };
  const nextItems      = { ...state.items, Milk: new Decimal(currentMilk).add(1) };

  return {
    ...state,
        items: nextItems, // alias
    cows:       { ...state.cows, [action.index]: { fedAt: undefined } },
    milestones: trackMilestone(state.milestones, "Milk Collected", 1),
    skills:     newSkills,
  };
}

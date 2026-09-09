import Decimal from "decimal.js-light";
import { GameState } from "@/shared/types/gameplay/game";
import { COW_TIME_TO_MILK } from "@/shared/game/constants";
import { trackActivity } from "@/shared/game/activity";
import { getSkillXP } from "@/shared/game/skills";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";

export type CollectMilkAction = { type: "cow.collectMilk"; index: number };
type Options = { state: GameState; action: CollectMilkAction; createdAt?: number };

export function collectMilk({ state, action, createdAt = Date.now() }: Options): GameState {
  const cowCount = state.inventory.Cow ?? 0;
  if (action.index < 0 || action.index >= Number(cowCount)) throw new Error("Cow does not exist");

  const cow = state.cows[action.index];
  if (!cow?.fedAt) throw new Error("Cow has not been fed");
  if (createdAt - cow.fedAt < COW_TIME_TO_MILK) throw new Error("Milk is not ready yet");

  const baseAmount  = cow.multiplier || 1;
  const yieldMult   = 1 + (state.bonus.produceYield ?? 0);
  const doubled     = Math.random() < (state.bonus.produceDouble ?? 0);
  const milkAmount  = Math.floor(baseAmount * yieldMult) * (doubled ? 2 : 1);
  const currentMilk = state.inventory.Milk ?? new Decimal(0);

  const collectXP      = getSkillXP("collect_milk");
  const newHusbandryXP = (state.skills.husbandry ?? 0) + collectXP;
  const newSkills      = { ...state.skills, husbandry: newHusbandryXP };

  return {
    ...state,
    inventory: { ...state.inventory, Milk: new Decimal(currentMilk).add(milkAmount) },
    cows:      { ...state.cows, [action.index]: { fedAt: undefined, multiplier: 1 } },
    activity:  trackActivity(state.activity, "Milk Collected", milkAmount),
    skills:    newSkills,
    bonus:     recomputeOwnedBonuses(newSkills, state.ownedCollectibles),
  };
}

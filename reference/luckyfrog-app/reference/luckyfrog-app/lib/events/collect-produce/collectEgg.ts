import Decimal from "decimal.js-light";
import { GameState } from "@/shared/types/gameplay/game";
import { CHICKEN_TIME_TO_EGG } from "@/shared/game/constants";
import { trackActivity } from "@/shared/game/activity";
import { getSkillXP } from "@/shared/game/skills";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";

export type CollectEggAction = { type: "chicken.collectEgg"; index: number };
type Options = { state: GameState; action: CollectEggAction; createdAt?: number };

export function collectEgg({ state, action, createdAt = Date.now() }: Options): GameState {
  const chickenCount = state.inventory.Chicken ?? 0;
  if (action.index < 0 || action.index >= Number(chickenCount)) throw new Error("Chicken does not exist");

  const chicken = state.chickens[action.index];
  if (!chicken?.fedAt) throw new Error("Chicken has not been fed");
  if (createdAt - chicken.fedAt < CHICKEN_TIME_TO_EGG) throw new Error("Egg is not ready yet");

  const baseAmount     = chicken.multiplier || 1;
  const yieldMult      = 1 + (state.bonus.produceYield ?? 0);
  const doubled        = Math.random() < (state.bonus.produceDouble ?? 0);
  const eggAmount      = Math.floor(baseAmount * yieldMult) * (doubled ? 2 : 1);
  const currentEggs    = state.inventory.Egg ?? new Decimal(0);

  const collectXP      = getSkillXP("collect_egg");
  const newHusbandryXP = (state.skills.husbandry ?? 0) + collectXP;
  const newSkills      = { ...state.skills, husbandry: newHusbandryXP };

  return {
    ...state,
    inventory: { ...state.inventory, Egg: new Decimal(currentEggs).add(eggAmount) },
    chickens:  { ...state.chickens, [action.index]: { fedAt: undefined, multiplier: 1 } },
    activity:  trackActivity(state.activity, "Egg Collected", eggAmount),
    skills:    newSkills,
    bonus:     recomputeOwnedBonuses(newSkills, state.ownedCollectibles),
  };
}

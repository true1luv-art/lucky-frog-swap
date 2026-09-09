import Decimal from "decimal.js-light";
import { GameState } from "@/shared/types/gameplay/game";
import { SHEEP_TIME_TO_WOOL } from "@/shared/game/constants";
import { trackActivity } from "@/shared/game/activity";
import { getSkillXP } from "@/shared/game/skills";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";

export type CollectWoolAction = { type: "sheep.collectWool"; index: number };
type Options = { state: GameState; action: CollectWoolAction; createdAt?: number };

export function collectWool({ state, action, createdAt = Date.now() }: Options): GameState {
  const sheepCount = state.inventory.Sheep ?? 0;
  if (action.index < 0 || action.index >= Number(sheepCount)) throw new Error("Sheep does not exist");

  const sheep = state.sheep[action.index];
  if (!sheep?.fedAt) throw new Error("Sheep has not been fed");
  if (createdAt - sheep.fedAt < SHEEP_TIME_TO_WOOL) throw new Error("Wool is not ready yet");

  const baseAmount  = sheep.multiplier || 1;
  const yieldMult   = 1 + (state.bonus.produceYield ?? 0);
  const doubled     = Math.random() < (state.bonus.produceDouble ?? 0);
  const woolAmount  = Math.floor(baseAmount * yieldMult) * (doubled ? 2 : 1);
  const currentWool = state.inventory.Wool ?? new Decimal(0);

  const collectXP      = getSkillXP("collect_wool");
  const newHusbandryXP = (state.skills.husbandry ?? 0) + collectXP;
  const newSkills      = { ...state.skills, husbandry: newHusbandryXP };

  return {
    ...state,
    inventory: { ...state.inventory, Wool: new Decimal(currentWool).add(woolAmount) },
    sheep:     { ...state.sheep, [action.index]: { fedAt: undefined, multiplier: 1 } },
    activity:  trackActivity(state.activity, "Wool Collected", woolAmount),
    skills:    newSkills,
    bonus:     recomputeOwnedBonuses(newSkills, state.ownedCollectibles),
  };
}

import Decimal from "decimal.js-light";
import { GameState } from "@/shared/types/gameplay/game";
import { CROPS } from "@/shared/types/gameplay/crops";
import { screenTracker } from "@/lib/utils/screen";
import { getHarvestXP, getSkillLevel } from "@/shared/game/skills";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";
import { getCropYield, rollCropDouble } from "@/shared/game/boosts";
import { hasEnoughStamina, deductStamina } from "@/shared/game/stamina";
import { trackActivity } from "@/shared/game/activity";
import { ActivityName } from "@/shared/types/gameplay/achievements";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";

export type HarvestAction = { type: "item.harvested"; index: number };
type Options = { state: GameState; action: HarvestAction; createdAt?: number };

export function harvest({ state, action, createdAt = Date.now() }: Options): GameState {
  if (!hasEnoughStamina(state.stamina.current, "harvest_crop")) throw new Error("Not enough stamina to harvest");

  const fields = { ...state.fields };
  if (action.index < 0 || !Number.isInteger(action.index) || action.index > 29) throw new Error("Field does not exist");

  const field = fields[action.index];
  if (!field) throw new Error("Nothing was planted");

  const crops    = CROPS();
  const cropName = field.name as keyof typeof crops;
  const crop     = crops[cropName];
  if (!crop) throw new Error("Not a crop field");
  if (createdAt - (field.plantedAt ?? 0) < crop.harvestSeconds * 1000) throw new Error("Not ready");
  if (!screenTracker.calculate()) throw new Error("Invalid harvest");

  delete fields[action.index];

  const bonus       = state.bonus ?? { ...INITIAL_BONUS };
  const boosted     = getCropYield(field.amount ?? 1, bonus);
  const yieldAmount = rollCropDouble(bonus) ? boosted * 2 : boosted;

  const cropCount    = new Decimal(state.inventory[field.name] || 0);
  const harvestXP    = getHarvestXP(field.name);
  const newFarmingXP = (state.skills.farming ?? 0) + harvestXP;

  const oldLevel = getSkillLevel(state.skills.farming ?? 0);
  const newLevel = getSkillLevel(newFarmingXP);
  const newBonus = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(
        { ...state.skills, farming: newFarmingXP },
        state.ownedCollectibles,
      )
    : bonus;

  let activity = trackActivity(state.activity, "Crop Harvested", 1);
  activity = trackActivity(activity, `${field.name} Harvested` as ActivityName, 1);

  return {
    ...state,
    fields,
    inventory: { ...state.inventory, [field.name]: cropCount.add(yieldAmount) },
    skills:    { ...state.skills, farming: newFarmingXP },
    bonus:     newBonus,
    stamina:   { ...state.stamina, current: deductStamina(state.stamina.current, "harvest_crop") },
    activity,
  } as GameState;
}

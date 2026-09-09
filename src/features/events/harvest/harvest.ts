import Decimal from "decimal.js-light";
import { GameState } from "@/features/types/gameplay/game";
import { CROPS } from "@/features/types/gameplay/crops";
import { screenTracker } from "@/features/utils/screen";
import { getHarvestXP } from "@/features/game/skills";
import { trackMilestone } from "@/features/game/milestones";
import { MilestoneName } from "@/features/types/gameplay/milestones";

export type HarvestAction = { type: "item.harvested"; index: number };
type Options = { state: GameState; action: HarvestAction; createdAt?: number };

export function harvest({ state, action, createdAt = Date.now() }: Options): GameState {
  const fields = { ...state.fields };
  if (action.index < 0 || !Number.isInteger(action.index) || action.index > 65) throw new Error("Field does not exist");

  const field = fields[action.index];
  if (!field) throw new Error("Nothing was planted");

  const crops    = CROPS();
  const cropName = field.name as keyof typeof crops;
  const crop     = crops[cropName];
  if (!crop) throw new Error("Not a crop field");

  // Crops must be watered before they can be harvested
  if (!field.isWatered) throw new Error("Crop needs watering first");
  const growthMs = crop.harvestSeconds * 1000;
  if (createdAt < (field.wateredAt ?? 0) + growthMs) throw new Error("Not ready");
  if (!screenTracker.calculate()) throw new Error("Invalid harvest");

  delete fields[action.index];

  const cropCount    = new Decimal((state.items as Record<string, Decimal>)[field.name] || 0);
  const harvestXP    = getHarvestXP(field.name);
  const newFarmingXP = (state.skills.farming ?? 0) + harvestXP;

  let milestones = trackMilestone(state.milestones, "Crop Harvested", 1);
  milestones = trackMilestone(milestones, `${field.name} Harvested` as MilestoneName, 1);

  const nextItems = { ...state.items, [field.name]: cropCount.add(1) };

  return {
    ...state,
    fields,
        items: nextItems, // alias
    skills:     { ...state.skills, farming: newFarmingXP },
    milestones,
  } as GameState;
}

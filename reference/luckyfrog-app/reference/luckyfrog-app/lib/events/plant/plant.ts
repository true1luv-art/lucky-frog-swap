import Decimal from "decimal.js-light";
import { screenTracker } from "@/lib/utils/screen";
import { CropName, CROPS, SEEDS, SeedName } from "@/shared/types/gameplay/crops";
import { GameState, Inventory, InventoryItemName } from "@/shared/types/gameplay/game";
import { isFieldUnlocked, getFieldLevelRequirement } from "@/shared/game/experience";
import { getSkillLevel } from "@/shared/game/skills";
import { getCropSpeedMultiplier, getSnapshotTimestamp } from "@/shared/game/boosts";

export type PlantAction = {
  type: "item.planted";
  item?: InventoryItemName;
  index: number;
};

const VALID_SEEDS: InventoryItemName[] = [
  "Potato Seed", "Carrot Seed", "Cabbage Seed", "Pumpkin Seed",
  "Beetroot Seed", "Parsnip Seed", "Radish Seed", "Cauliflower Seed",
  "Wheat Seed", "Kale Seed",
];

export function isSeed(crop: InventoryItemName): crop is SeedName {
  return VALID_SEEDS.includes(crop);
}

export const getCropTime = (crop: CropName, _inventory: Inventory, state?: GameState) => {
  let seconds = CROPS()[crop].harvestSeconds;
  if (state?.bonus) seconds = seconds * getCropSpeedMultiplier(state.bonus);
  return seconds;
};

type Options = { state: GameState; action: PlantAction; createdAt?: number };

function getPlantedAt({ crop, state, createdAt }: { crop: CropName; state: GameState; createdAt: number }): number {
  const cropTime = CROPS()[crop].harvestSeconds;
  return getSnapshotTimestamp(createdAt, cropTime * 1000, state.bonus?.cropSpeed ?? 0);
}

export function plant({ state, action, createdAt = Date.now() }: Options): GameState {
  const fields = { ...state.fields };
  if (action.index < 0 || !Number.isInteger(action.index) || action.index > 29) throw new Error("Field does not exist");

  const farmingLevel = getSkillLevel(state.skills.farming);
  if (!isFieldUnlocked(action.index, farmingLevel)) {
    throw new Error(`Field requires Farming Level ${getFieldLevelRequirement(action.index)}`);
  }
  if (fields[action.index]) throw new Error("Crop is already planted");
  if (!action.item)         throw new Error("No seed selected");
  if (!isSeed(action.item)) throw new Error("Not a seed");

  const seedCount = new Decimal(state.inventory[action.item] || 0);
  if (seedCount.lessThan(1)) throw new Error("Not enough seeds");
  if (!screenTracker.calculate()) throw new Error("Invalid plant");

  const crop = action.item.split(" ")[0] as CropName;
  const seedLevelRequirement = SEEDS()[action.item].levelRequirement ?? 0;
  if (farmingLevel < seedLevelRequirement) {
    throw new Error(`Seed requires Farming Level ${seedLevelRequirement}`);
  }

  return {
    ...state,
    inventory: { ...state.inventory, [action.item]: seedCount.sub(1) },
    fields: {
      ...fields,
      [action.index]: {
        name:      crop,
        plantedAt: getPlantedAt({ crop, state, createdAt }),
        amount:    1,
      },
    },
  } as GameState;
}

/**
 * features/events/water/waterField.ts
 *
 * Water a planted field with the Watering Can.
 *
 * Crops only start growing AFTER watering. `plant` sets `plantedAt` only.
 * `waterField` sets `wateredAt` and `isWatered = true`.
 * Readiness is computed as: isWatered && Date.now() >= wateredAt + growthMs.
 *
 * Watering Can durability is decremented per water action.
 * A Wood-tier Watering Can has infinite durability (null).
 */

import type { GameState } from "@/features/types/gameplay/game";
import { CROPS } from "@/features/types/gameplay/crops";
import type { CropName } from "@/features/types/gameplay/crops";
import { decrementDurability } from "@/features/types/gameplay/tools";
import { getSkillXP } from "@/features/game/skills";

export type WaterAction      = { type: "field.watered"; index: number };
/** Alias used by events/index.ts */
export type WaterFieldAction = WaterAction;
type Options = { state: GameState; action: WaterAction; createdAt?: number };

export function waterField({ state, action, createdAt = Date.now() }: Options): GameState {
  // Find Watering Can in tools[]
  const canIdx = state.tools.findIndex((t) => t.name === "Watering Can");
  if (canIdx === -1) throw new Error("No Watering Can — craft one at the Blacksmith");
  const can = state.tools[canIdx];

  // Field must exist and be planted
  const field = state.fields[action.index];
  if (!field) throw new Error("Nothing planted in that field");
  if (!field.plantedAt) throw new Error("Field is not planted");
  if (field.isWatered) throw new Error("Field has already been watered");

  // Resolve crop to confirm it exists (not used beyond the check here)
  const crops    = CROPS();
  const cropName = field.name as CropName;
  const crop     = crops[cropName];
  if (!crop) throw new Error("Unknown crop");

  // Decrement Watering Can durability
  const decremented = decrementDurability(can);
  const nextTools   = [...state.tools];
  if (decremented === null) {
    nextTools.splice(canIdx, 1);
  } else {
    nextTools[canIdx] = decremented;
  }

  const newFarmingXP = (state.skills.farming ?? 0) + getSkillXP("water_field");

  return {
    ...state,
    tools: nextTools,
    fields: {
      ...state.fields,
      [action.index]: {
        ...field,
        wateredAt: createdAt,
        isWatered: true,
      },
    },
    skills: { ...state.skills, farming: newFarmingXP },
  };
}

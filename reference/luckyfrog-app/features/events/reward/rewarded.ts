import Decimal from "decimal.js-light";
import { CROPS } from "@/features/types/gameplay/crops";
import { GameState } from "@/features/types/gameplay/game";

export type OpenRewardAction = { type: "reward.opened"; fieldIndex: number };
type Options = { state: GameState; action: OpenRewardAction; createdAt?: number };

export function openReward({ state, action, createdAt = Date.now() }: Options): GameState {
  const field = state.fields[action.fieldIndex];
  if (!field)        throw new Error("Field does not exist");
  if (!field.reward) throw new Error("Field does not have a reward");

  const crops    = CROPS();
  const cropName = field.name as keyof typeof crops;
  const crop     = crops[cropName];
  if (!crop) throw new Error("Not a crop field");
  if (createdAt - (field.plantedAt ?? 0) < crop.harvestSeconds * 1000) throw new Error("Not ready");

  const seed        = field.reward.items[0];
  const items    = { ...state.items };
  const seedBalance = items[seed.name] || new Decimal(0);
  items[seed.name] = new Decimal(seedBalance).add(seed.amount);

  const fields = { ...state.fields };
  delete fields[action.fieldIndex].reward;

  return { ...state, fields, items };
}

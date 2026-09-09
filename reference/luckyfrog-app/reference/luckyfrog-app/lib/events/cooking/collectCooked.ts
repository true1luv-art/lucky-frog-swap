import Decimal from "decimal.js-light";
import { GameState } from "@/shared/types/gameplay/game";

export type CollectCookedAction = { type: "food.collectCooked" };
type Options = { state: GameState; action: CollectCookedAction; createdAt?: number };

export enum COLLECT_COOKED_ERRORS {
  NOTHING_COOKING = "Nothing is cooking",
  NOT_READY       = "Food is not ready yet",
}

export function collectCooked({ state, createdAt = Date.now() }: Options): GameState {
  const slot = state.cooking;
  if (!slot) throw new Error(COLLECT_COOKED_ERRORS.NOTHING_COOKING);
  if (createdAt - slot.startedAt < slot.duration * 1000) throw new Error(COLLECT_COOKED_ERRORS.NOT_READY);

  const existing = new Decimal(state.inventory[slot.item] ?? 0);
  return {
    ...state,
    inventory: { ...state.inventory, [slot.item]: existing.add(1) },
    cooking:   null,
  };
}

import Decimal from "decimal.js-light";
import { GameState, Inventory } from "@/shared/types/gameplay/game";
import { MAX_CHICKENS, CHICKEN_TIME_TO_EGG, CHICKEN_RE_HUNGER_DELAY } from "@/shared/game/constants";
import { trackActivity } from "@/shared/game/activity";
import { getSnapshotTimestamp } from "@/shared/game/boosts";

export type FeedChickenAction = { type: "chicken.feed"; index: number };
type Options = { state: GameState; action: FeedChickenAction; createdAt?: number };

export function getMaxChickens(_inventory: Inventory): number { return MAX_CHICKENS; }
export function getFeedRequiredToFeed(_inventory: Inventory): number { return 1; }

export function feedChicken({ state, action, createdAt = Date.now() }: Options): GameState {
  const chickenCount = state.inventory.Chicken ?? 0;
  if (action.index < 0 || action.index >= Number(chickenCount)) throw new Error("Chicken does not exist");

  const chicken    = state.chickens[action.index];
  const isRehungry = chicken?.fedAt !== undefined &&
    createdAt - chicken.fedAt >= CHICKEN_TIME_TO_EGG + CHICKEN_RE_HUNGER_DELAY;

  if (chicken?.fedAt && !isRehungry) throw new Error("Chicken is not hungry");

  const currentWheat = state.inventory["Wheat"] ?? new Decimal(0);
  if (new Decimal(currentWheat).lt(1)) throw new Error("Not enough Wheat to feed chicken");

  return {
    ...state,
    inventory: { ...state.inventory, Wheat: new Decimal(currentWheat).sub(1) },
    chickens:  {
      ...state.chickens,
      [action.index]: {
        fedAt: getSnapshotTimestamp(createdAt, CHICKEN_TIME_TO_EGG, state.bonus.produceSpeed),
        multiplier: 1,
      },
    },
    activity:  trackActivity(state.activity, "Animal Fed", 1),
  };
}

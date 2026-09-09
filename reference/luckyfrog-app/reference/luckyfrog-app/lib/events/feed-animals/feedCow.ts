import Decimal from "decimal.js-light";
import { GameState } from "@/shared/types/gameplay/game";
import { COW_TIME_TO_MILK, COW_RE_HUNGER_DELAY } from "@/shared/game/constants";
import { trackActivity } from "@/shared/game/activity";
import { getSnapshotTimestamp } from "@/shared/game/boosts";

export type FeedCowAction = { type: "cow.feed"; index: number };
type Options = { state: GameState; action: FeedCowAction; createdAt?: number };

export function feedCow({ state, action, createdAt = Date.now() }: Options): GameState {
  const cow        = state.cows[action.index];
  const isRehungry = cow?.fedAt !== undefined &&
    createdAt - cow.fedAt >= COW_TIME_TO_MILK + COW_RE_HUNGER_DELAY;

  if (cow?.fedAt && !isRehungry) throw new Error("Cow is not hungry");

  const currentKale = state.inventory["Kale"] ?? new Decimal(0);
  if (new Decimal(currentKale).lt(1)) throw new Error("Not enough Kale to feed cow");

  return {
    ...state,
    inventory: { ...state.inventory, Kale: new Decimal(currentKale).sub(1) },
    cows: {
      ...state.cows,
      [action.index]: {
        fedAt: getSnapshotTimestamp(createdAt, COW_TIME_TO_MILK, state.bonus.produceSpeed),
        multiplier: 1,
      },
    },
    activity:  trackActivity(state.activity, "Animal Fed", 1),
  };
}

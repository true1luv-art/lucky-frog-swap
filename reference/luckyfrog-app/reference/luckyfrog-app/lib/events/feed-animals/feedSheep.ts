import Decimal from "decimal.js-light";
import { GameState } from "@/shared/types/gameplay/game";
import { SHEEP_TIME_TO_WOOL, SHEEP_RE_HUNGER_DELAY } from "@/shared/game/constants";
import { trackActivity } from "@/shared/game/activity";
import { getSnapshotTimestamp } from "@/shared/game/boosts";

export type FeedSheepAction = { type: "sheep.feed"; index: number };
type Options = { state: GameState; action: FeedSheepAction; createdAt?: number };

export function feedSheep({ state, action, createdAt = Date.now() }: Options): GameState {
  const sheep      = state.sheep[action.index];
  const isRehungry = sheep?.fedAt !== undefined &&
    createdAt - sheep.fedAt >= SHEEP_TIME_TO_WOOL + SHEEP_RE_HUNGER_DELAY;

  if (sheep?.fedAt && !isRehungry) throw new Error("Sheep is not hungry");

  const currentCabbage = state.inventory["Cabbage"] ?? new Decimal(0);
  if (new Decimal(currentCabbage).lt(1)) throw new Error("Not enough Cabbage to feed sheep");

  return {
    ...state,
    inventory: { ...state.inventory, Cabbage: new Decimal(currentCabbage).sub(1) },
    sheep: {
      ...state.sheep,
      [action.index]: {
        fedAt: getSnapshotTimestamp(createdAt, SHEEP_TIME_TO_WOOL, state.bonus.produceSpeed),
        multiplier: 1,
      },
    },
    activity:  trackActivity(state.activity, "Animal Fed", 1),
  };
}

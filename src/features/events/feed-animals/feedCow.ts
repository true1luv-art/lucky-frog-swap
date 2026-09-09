import Decimal from "decimal.js-light";
import { GameState } from "@/features/types/gameplay/game";
import { ANIMALS_CONFIG } from "@/features/game/animals";
import { trackMilestone } from "@/features/game/milestones";


export type FeedCowAction = { type: "cow.feed"; index: number };
type Options = { state: GameState; action: FeedCowAction; createdAt?: number };

export function feedCow({ state, action, createdAt = Date.now() }: Options): GameState {
  const cow        = state.cows[action.index];
  const isRehungry = cow?.fedAt !== undefined &&
    createdAt - cow.fedAt >= ANIMALS_CONFIG.Cow.produceTimeMs + ANIMALS_CONFIG.Cow.reHungerDelayMs;

  if (cow?.fedAt && !isRehungry) throw new Error("Cow is not hungry");

  const { feedItem, feedAmount } = ANIMALS_CONFIG.Cow;
  const currentFeed = state.items[feedItem] ?? new Decimal(0);
  if (new Decimal(currentFeed).lt(feedAmount))
    throw new Error(`Not enough ${feedItem} to feed cow`);
  const nextItems = { ...state.items, [feedItem]: new Decimal(currentFeed).sub(feedAmount) };

  return {
    ...state,
        items: nextItems, // alias
    cows: {
      ...state.cows,
      [action.index]: {
        fedAt: createdAt,
      },
    },
    milestones: trackMilestone(state.milestones, "Animal Fed", 1),
  };
}

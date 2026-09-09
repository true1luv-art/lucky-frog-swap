import Decimal from "decimal.js-light";
import { GameState } from "@/features/types/gameplay/game";
import { ANIMALS_CONFIG } from "@/features/game/animals";
import { trackMilestone } from "@/features/game/milestones";


export type FeedSheepAction = { type: "sheep.feed"; index: number };
type Options = { state: GameState; action: FeedSheepAction; createdAt?: number };

export function feedSheep({ state, action, createdAt = Date.now() }: Options): GameState {
  const sheep      = state.sheep[action.index];
  const isRehungry = sheep?.fedAt !== undefined &&
    createdAt - sheep.fedAt >= ANIMALS_CONFIG.Sheep.produceTimeMs + ANIMALS_CONFIG.Sheep.reHungerDelayMs;

  if (sheep?.fedAt && !isRehungry) throw new Error("Sheep is not hungry");

  const { feedItem, feedAmount } = ANIMALS_CONFIG.Sheep;
  const currentFeed = state.items[feedItem] ?? new Decimal(0);
  if (new Decimal(currentFeed).lt(feedAmount))
    throw new Error(`Not enough ${feedItem} to feed sheep`);
  const nextItems = { ...state.items, [feedItem]: new Decimal(currentFeed).sub(feedAmount) };

  return {
    ...state,
        items: nextItems, // alias
    sheep: {
      ...state.sheep,
      [action.index]: {
        fedAt: createdAt,
      },
    },
    milestones: trackMilestone(state.milestones, "Animal Fed", 1),
  };
}

import Decimal from "decimal.js-light";
import { GameState, Inventory } from "@/features/types/gameplay/game";

import { ANIMALS_CONFIG } from "@/features/game/animals";
import { trackMilestone } from "@/features/game/milestones";


export type FeedChickenAction = { type: "chicken.feed"; index: number };
type Options = { state: GameState; action: FeedChickenAction; createdAt?: number };

export function getMaxChickens(_inventory: Inventory): number { return ANIMALS_CONFIG.Chicken.maxCount; }
export function getFeedRequiredToFeed(_inventory: Inventory): number { return 1; }

export function feedChicken({ state, action, createdAt = Date.now() }: Options): GameState {
  const chickenCount = state.items.Chicken ?? 0;
  if (action.index < 0 || action.index >= Number(chickenCount)) throw new Error("Chicken does not exist");

  const chicken    = state.chickens[action.index];
  const isRehungry = chicken?.fedAt !== undefined &&
    createdAt - chicken.fedAt >= ANIMALS_CONFIG.Chicken.produceTimeMs + ANIMALS_CONFIG.Chicken.reHungerDelayMs;

  if (chicken?.fedAt && !isRehungry) throw new Error("Chicken is not hungry");

  const { feedItem, feedAmount } = ANIMALS_CONFIG.Chicken;
  const currentFeed = state.items[feedItem] ?? new Decimal(0);
  if (new Decimal(currentFeed).lt(feedAmount))
    throw new Error(`Not enough ${feedItem} to feed chicken`);
  const nextItems = { ...state.items, [feedItem]: new Decimal(currentFeed).sub(feedAmount) };

  return {
    ...state,
        items: nextItems, // alias
    chickens:  {
      ...state.chickens,
      [action.index]: {
        fedAt: createdAt,
      },
    },
    milestones: trackMilestone(state.milestones, "Animal Fed", 1),
  };
}

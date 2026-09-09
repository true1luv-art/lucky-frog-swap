/**
 * Central event dispatcher for the farming game.
 * All event functions use an Options struct: { state, action, createdAt? }.
 * The processGameEvent function bridges the Zustand store's send() calls.
 *
 * Event implementations live in lib/events/<folder>/ and are imported here.
 */
import type { GameState } from "@/shared/types/gameplay";

// ---------------------------------------------------------------------------
// Action union
// ---------------------------------------------------------------------------
import type { PlantAction }            from "@/lib/events/plant/plant";
import type { HarvestAction }          from "@/lib/events/harvest/harvest";
import type { ChopAction }             from "@/lib/events/chop/chop";
import type { SellAction }             from "@/lib/events/sell/sell";

import type { MineAction }             from "@/lib/events/mine/mine";
import type { CraftAction }            from "@/lib/events/craft/craft";
import type { CraftCollectibleAction } from "@/lib/modules/collectibles/forge.server";
import type { SellFoodAction }         from "@/lib/events/sell/sellFood";
import type { ConsumeFoodAction }      from "@/lib/events/consume/consumeFood";
import type { SellProduceAction }      from "@/lib/events/sell/sellProduce";
import type { FeedChickenAction }      from "@/lib/events/feed-animals/feedChicken";
import type { CollectEggAction }       from "@/lib/events/collect-produce/collectEgg";
import type { FeedCowAction }          from "@/lib/events/feed-animals/feedCow";
import type { CollectMilkAction }      from "@/lib/events/collect-produce/collectMilk";
import type { FeedSheepAction }        from "@/lib/events/feed-animals/feedSheep";
import type { CollectWoolAction }      from "@/lib/events/collect-produce/collectWool";
import type { CatchFishAction }        from "@/lib/events/fishing/catchFish";
import type { StartCookingAction }     from "@/lib/events/cooking/startCooking";
import type { CollectCookedAction }    from "@/lib/events/cooking/collectCooked";
import type { StaminaRegenAction }     from "@/lib/events/stamina/staminaRegen";
import type { ClaimAchievementAction } from "@/lib/events/achievement/claimAchievement";
import type { OpenRewardAction }       from "@/lib/events/reward/rewarded";

export type GameAction =
  | PlantAction
  | HarvestAction
  | ChopAction
  | MineAction
  | SellAction
  | CraftAction
  | CraftCollectibleAction
  | SellFoodAction
  | ConsumeFoodAction
  | SellProduceAction
  | FeedChickenAction
  | CollectEggAction
  | FeedCowAction
  | CollectMilkAction
  | FeedSheepAction
  | CollectWoolAction
  | CatchFishAction
  | StartCookingAction
  | CollectCookedAction
  | StaminaRegenAction
  | ClaimAchievementAction
  | OpenRewardAction;

export interface GameEvent {
  action: GameAction;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Function re-exports
// ---------------------------------------------------------------------------
export { plant }            from "@/lib/events/plant/plant";
export { harvest }          from "@/lib/events/harvest/harvest";
export { chop }             from "@/lib/events/chop/chop";
export { mine }             from "@/lib/events/mine/mine";
export { sell }             from "@/lib/events/sell/sell";
export { craft }            from "@/lib/events/craft/craft";
export { sellFood }         from "@/lib/events/sell/sellFood";
export { consumeFood }      from "@/lib/events/consume/consumeFood";
export { sellProduce }      from "@/lib/events/sell/sellProduce";
export { feedChicken }      from "@/lib/events/feed-animals/feedChicken";
export { collectEgg }       from "@/lib/events/collect-produce/collectEgg";
export { feedCow }          from "@/lib/events/feed-animals/feedCow";
export { collectMilk }      from "@/lib/events/collect-produce/collectMilk";
export { feedSheep }        from "@/lib/events/feed-animals/feedSheep";
export { collectWool }      from "@/lib/events/collect-produce/collectWool";
export { catchFish }        from "@/lib/events/fishing/catchFish";
export { startCooking }     from "@/lib/events/cooking/startCooking";
export { collectCooked }    from "@/lib/events/cooking/collectCooked";
export { staminaRegen }     from "@/lib/events/stamina/staminaRegen";
export { claimAchievement } from "@/lib/events/achievement/claimAchievement";
export { openReward }       from "@/lib/events/reward/rewarded";

// ---------------------------------------------------------------------------
// Central dispatcher
// ---------------------------------------------------------------------------
import { plant }            from "@/lib/events/plant/plant";
import { harvest }          from "@/lib/events/harvest/harvest";
import { chop }             from "@/lib/events/chop/chop";
import { mine }             from "@/lib/events/mine/mine";
import { sell }             from "@/lib/events/sell/sell";
import { craft }            from "@/lib/events/craft/craft";
import { sellFood }         from "@/lib/events/sell/sellFood";
import { consumeFood }      from "@/lib/events/consume/consumeFood";
import { sellProduce }      from "@/lib/events/sell/sellProduce";
import { feedChicken }      from "@/lib/events/feed-animals/feedChicken";
import { collectEgg }       from "@/lib/events/collect-produce/collectEgg";
import { feedCow }          from "@/lib/events/feed-animals/feedCow";
import { collectMilk }      from "@/lib/events/collect-produce/collectMilk";
import { feedSheep }        from "@/lib/events/feed-animals/feedSheep";
import { collectWool }      from "@/lib/events/collect-produce/collectWool";
import { catchFish }        from "@/lib/events/fishing/catchFish";
import { startCooking }     from "@/lib/events/cooking/startCooking";
import { collectCooked }    from "@/lib/events/cooking/collectCooked";
import { staminaRegen }     from "@/lib/events/stamina/staminaRegen";
import { claimAchievement } from "@/lib/events/achievement/claimAchievement";
import { openReward }       from "@/lib/events/reward/rewarded";

export function processGameEvent(state: GameState, event: GameEvent): GameState {
  const { action, createdAt } = event;
  try {
    switch (action.type) {
      case "item.planted":
        return plant({ state, action, createdAt });
      case "item.harvested":
        return harvest({ state, action, createdAt });
      case "tree.chopped":
        return chop({ state, action, createdAt });
      case "stone.mined":
      case "iron.mined":
      case "gold.mined":
        return mine({ state, action, createdAt });
      case "item.sell":
        return sell({ state, action });
      case "item.crafted":
        return craft({ state, action });
      case "food.sell":
        return sellFood({ state, action });
      case "food.consume":
        return consumeFood({ state, action });
      case "produce.sell":
        return sellProduce({ state, action });
      case "chicken.feed":
        return feedChicken({ state, action, createdAt });
      case "chicken.collectEgg":
        return collectEgg({ state, action, createdAt });
      case "cow.feed":
        return feedCow({ state, action, createdAt });
      case "cow.collectMilk":
        return collectMilk({ state, action, createdAt });
      case "sheep.feed":
        return feedSheep({ state, action, createdAt });
      case "sheep.collectWool":
        return collectWool({ state, action, createdAt });
      case "fish.caught":
        return catchFish({ state, action });
      case "food.startCooking":
        return startCooking({ state, action, createdAt });
      case "food.collectCooked":
        return collectCooked({ state, action });
      case "stamina.regenerate":
        return staminaRegen({ state, action });
      case "achievement.claimed":
        return claimAchievement({ state, action, createdAt });
      case "reward.opened":
        return openReward({ state, action, createdAt });
      default:
        return state;
    }
  } catch (e) {
    console.error("[v0] processGameEvent error:", (e as Error).message, action);
    return state;
  }
}

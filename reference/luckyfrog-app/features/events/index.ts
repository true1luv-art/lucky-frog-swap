/**
 * Central event dispatcher for the farming game.
 * All event functions use an Options struct: { state, action, createdAt? }.
 * The processGameEvent function bridges the Zustand store's send() calls.
 *
 * Event implementations live in lib/events/<folder>/ and are imported here.
 */
import type { GameState } from "@/features/types/gameplay";

// ---------------------------------------------------------------------------
// Action union
// ---------------------------------------------------------------------------
import type { PlantAction }            from "@/features/events/plant/plant";
import type { HarvestAction }          from "@/features/events/harvest/harvest";
import type { ChopAction }             from "@/features/events/chop/chop";
import type { MineAction }             from "@/features/events/mine/mine";
import type { ConsumeFoodAction }      from "@/features/events/consume/consumeFood";
import type { FeedChickenAction }      from "@/features/events/feed-animals/feedChicken";
import type { CollectEggAction }       from "@/features/events/collect-produce/collectEgg";
import type { FeedCowAction }          from "@/features/events/feed-animals/feedCow";
import type { CollectMilkAction }      from "@/features/events/collect-produce/collectMilk";
import type { FeedSheepAction }        from "@/features/events/feed-animals/feedSheep";
import type { CollectWoolAction }      from "@/features/events/collect-produce/collectWool";
import type { CatchFishAction }        from "@/features/events/fishing/catchFish";
import type { OpenRewardAction }       from "@/features/events/reward/rewarded";
import type { PurchaseAction }         from "@/features/events/purchase/purchase";
import type { CookFoodAction }         from "@/features/events/cooking/cookFood";
import type { CraftToolAction }        from "@/features/events/craft-tool/craftTool";
import type { CraftEquipmentAction }   from "@/features/events/equipment/craftEquipment";
import type { UpgradeEquipmentAction } from "@/features/events/equipment/upgradeEquipment";
import type { SellAction }             from "@/features/events/sell/sell";
import type { EquipEquipmentAction }   from "@/features/events/equipment/equipEquipment";
import type { FarmUpgradeAction }       from "@/features/events/farm-upgrade/farmUpgrade";
import type { CraftCoalAction }         from "@/features/events/craft-coal/craftCoal";
import type { SmeltOreAction }          from "@/features/events/smelt/smeltOre";
import type { WaterFieldAction }        from "@/features/events/water/waterField";
import type { DestroyArmorAction }      from "@/features/events/equipment/destroyArmor";
import type { SellResourceAction }      from "@/features/events/sell/sellResource";
import type { SellFoodAction }          from "@/features/events/sell/sellFood";
import type { SellProduceAction }       from "@/features/events/sell/sellProduce";

export type GameAction =
  | PlantAction
  | HarvestAction
  | PurchaseAction
  | ChopAction
  | MineAction
  | ConsumeFoodAction
  | FeedChickenAction
  | CollectEggAction
  | FeedCowAction
  | CollectMilkAction
  | FeedSheepAction
  | CollectWoolAction
  | CatchFishAction
  | CookFoodAction
  | CraftToolAction
  | CraftEquipmentAction
  | UpgradeEquipmentAction
  | EquipEquipmentAction
  | OpenRewardAction
  | FarmUpgradeAction
  | CraftCoalAction
  | SmeltOreAction
  | WaterFieldAction
  | DestroyArmorAction
  | SellAction
  | SellResourceAction
  | SellFoodAction
  | SellProduceAction;

export interface GameEvent {
  action: GameAction;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Function re-exports
// ---------------------------------------------------------------------------
export { plant }            from "@/features/events/plant/plant";
export { harvest }          from "@/features/events/harvest/harvest";
export { chop }             from "@/features/events/chop/chop";
export { mine }             from "@/features/events/mine/mine";
export { consumeFood }      from "@/features/events/consume/consumeFood";
export { feedChicken }      from "@/features/events/feed-animals/feedChicken";
export { collectEgg }       from "@/features/events/collect-produce/collectEgg";
export { feedCow }          from "@/features/events/feed-animals/feedCow";
export { collectMilk }      from "@/features/events/collect-produce/collectMilk";
export { feedSheep }        from "@/features/events/feed-animals/feedSheep";
export { collectWool }      from "@/features/events/collect-produce/collectWool";
export { catchFish }        from "@/features/events/fishing/catchFish";
export { openReward }       from "@/features/events/reward/rewarded";
export { cookFood }         from "@/features/events/cooking/cookFood";
export { craftTool }        from "@/features/events/craft-tool/craftTool";
export { craftEquipment }   from "@/features/events/equipment/craftEquipment";
export { upgradeEquipment } from "@/features/events/equipment/upgradeEquipment";
export { equipEquipment }   from "@/features/events/equipment/equipEquipment";
export { farmUpgrade }      from "@/features/events/farm-upgrade/farmUpgrade";
export { craftCoal }        from "@/features/events/craft-coal/craftCoal";
export { smeltOre }         from "@/features/events/smelt/smeltOre";
export { waterField }       from "@/features/events/water/waterField";
export { destroyArmor }     from "@/features/events/equipment/destroyArmor";
export { sell }             from "@/features/events/sell/sell";
export { sellResource }     from "@/features/events/sell/sellResource";
export { sellFood }         from "@/features/events/sell/sellFood";
export { sellProduce }      from "@/features/events/sell/sellProduce";

// ---------------------------------------------------------------------------
// Central dispatcher
// ---------------------------------------------------------------------------
import { plant }            from "@/features/events/plant/plant";
import { harvest }          from "@/features/events/harvest/harvest";
import { chop }             from "@/features/events/chop/chop";
import { mine }             from "@/features/events/mine/mine";
import { consumeFood }      from "@/features/events/consume/consumeFood";
import { feedChicken }      from "@/features/events/feed-animals/feedChicken";
import { collectEgg }       from "@/features/events/collect-produce/collectEgg";
import { feedCow }          from "@/features/events/feed-animals/feedCow";
import { collectMilk }      from "@/features/events/collect-produce/collectMilk";
import { feedSheep }        from "@/features/events/feed-animals/feedSheep";
import { collectWool }      from "@/features/events/collect-produce/collectWool";
import { catchFish }        from "@/features/events/fishing/catchFish";
import { openReward }       from "@/features/events/reward/rewarded";
import { purchase }         from "@/features/events/purchase/purchase";
import { cookFood }         from "@/features/events/cooking/cookFood";
import { craftTool }        from "@/features/events/craft-tool/craftTool";
import { craftEquipment }   from "@/features/events/equipment/craftEquipment";
import { upgradeEquipment } from "@/features/events/equipment/upgradeEquipment";
import { equipEquipment }   from "@/features/events/equipment/equipEquipment";
import { farmUpgrade }      from "@/features/events/farm-upgrade/farmUpgrade";
import { craftCoal }        from "@/features/events/craft-coal/craftCoal";
import { smeltOre }         from "@/features/events/smelt/smeltOre";
import { waterField }       from "@/features/events/water/waterField";
import { destroyArmor }     from "@/features/events/equipment/destroyArmor";
import { sell }             from "@/features/events/sell/sell";
import { sellResource }     from "@/features/events/sell/sellResource";
import { sellFood }         from "@/features/events/sell/sellFood";
import { sellProduce }      from "@/features/events/sell/sellProduce";

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
        return mine({ state, action, createdAt });
      case "food.cook":
        return cookFood(state, action);
      case "food.consume":
        return consumeFood({ state, action });
      case "tool.crafted":
        return craftTool({ state, action });
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
      case "equipment.craft":
        return craftEquipment({ state, action });
      case "equipment.upgrade":
        return upgradeEquipment({ state, action });
      case "equipment.equip":
        return equipEquipment({ state, action });
      case "item.crafted":
        return purchase({ state, action });
      case "reward.opened":
        return openReward({ state, action, createdAt });
      case "farm.upgrade":
        return farmUpgrade({ state, action });
      case "coal.crafted":
        return craftCoal({ state, action });
      case "ore.smelted":
        return smeltOre({ state, action });
      case "field.watered":
        return waterField({ state, action, createdAt });
      case "armor.destroyed":
        return destroyArmor({ state, action });
      case "item.sell":
        return sell({ state, action });
      case "resource.sell":
        return sellResource({ state, action });
      case "food.sell":
        return sellFood({ state, action });
      case "produce.sell":
        return sellProduce({ state, action });
      default:
        return state;
    }
  } catch (e) {
    console.error("[v0] processGameEvent error:", (e as Error).message, action);
    return state;
  }
}

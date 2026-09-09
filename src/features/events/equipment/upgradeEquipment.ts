import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay/game";
import type { EquipmentItem, EquipmentSlot } from "@/features/types/gameplay/equipment";
import { createInitialEquipment } from "@/features/types/gameplay/equipment";
import { applyUpgrade, getUpgradeShardCost, computePlayerStats } from "@/features/game/equipment";

export type UpgradeEquipmentAction = {
  type: "equipment.upgrade";
  /** Id of the piece to upgrade (may be equipped or in owned). */
  id: string;
};

type Options = { state: GameState; action: UpgradeEquipmentAction };

/**
 * upgradeEquipment — spends Gold to add +5% to every stat on a piece and bumps
 * its upgradeLevel. Works on both equipped and owned pieces.
 */
export function upgradeEquipment({ state, action }: Options): GameState {
  const equipment = state.equipment ?? createInitialEquipment();

  // Locate the piece — check equipped slots first, then owned.
  const equippedSlot = (Object.keys(equipment.equipped) as EquipmentSlot[]).find(
    (slot) => equipment.equipped[slot].id === action.id,
  );
  const ownedIndex = equipment.owned.findIndex((it) => it.id === action.id);

  const target: EquipmentItem | undefined = equippedSlot
    ? equipment.equipped[equippedSlot]
    : ownedIndex >= 0
      ? equipment.owned[ownedIndex]
      : undefined;

  if (!target) throw new Error("Equipment not found");
  if (target.tier === "Wood") throw new Error("Wood armor cannot be upgraded");

  const cost   = getUpgradeShardCost(target);
  const shards = new Decimal((state.items as Record<string, Decimal>)["Shard"] ?? 0);
  if (shards.lessThan(cost)) throw new Error(`Not enough Shards — need ${cost}`);

  const upgraded = applyUpgrade(target);

  const nextEquipped = { ...equipment.equipped };
  const nextOwned = [...equipment.owned];
  if (equippedSlot) {
    nextEquipped[equippedSlot] = upgraded;
  } else {
    nextOwned[ownedIndex] = upgraded;
  }

  const playerStats = computePlayerStats(nextEquipped);
  const nextItems   = { ...state.items, Shard: shards.sub(cost) };

  return {
    ...state,
        items: nextItems, // alias
    equipment:  { equipped: nextEquipped, owned: nextOwned },
    // Persist aggregate stats so the player doc stays in sync.
    playerStats,
  };
}

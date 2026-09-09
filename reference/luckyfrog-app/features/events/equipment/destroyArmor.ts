/**
 * features/events/equipment/destroyArmor.ts
 *
 * Salvage an Iron+ armor piece for Shards.
 *
 * Rules:
 * - Wood armor cannot be destroyed (free tier, no shard value).
 * - Payout = floor(tierRank² × 0.5) + upgradeLevel  (Proposal 2).
 * - The piece is removed from `equipment.owned[]`.
 *   Equipped pieces cannot be destroyed (must unequip first).
 */

import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay/game";
import type { EquipmentItem, EquipmentSlot } from "@/features/types/gameplay/equipment";
import { createInitialEquipment } from "@/features/types/gameplay/equipment";
import { getDestroyShardPayout } from "@/features/game/equipment";
import { getSkillXP } from "@/features/game/skills";

export type DestroyArmorAction = {
  type: "armor.destroyed";
  /** Id of the owned (unequipped) piece to destroy. */
  id: string;
};

type Options = { state: GameState; action: DestroyArmorAction };

export function destroyArmor({ state, action }: Options): GameState {
  const equipment = state.equipment ?? createInitialEquipment();

  // Cannot destroy currently equipped pieces — must unequip first
  const isEquipped = (Object.keys(equipment.equipped) as EquipmentSlot[]).some(
    (slot) => equipment.equipped[slot].id === action.id,
  );
  if (isEquipped) throw new Error("Cannot destroy an equipped armor piece — unequip it first");

  // Find in owned[]
  const ownedIndex = equipment.owned.findIndex((it: EquipmentItem) => it.id === action.id);
  if (ownedIndex === -1) throw new Error("Armor piece not found");

  const target = equipment.owned[ownedIndex];
  if (target.tier === "Wood") throw new Error("Wood armor has no shard value and cannot be destroyed");

  // Compute shard payout
  const shardPayout = getDestroyShardPayout(target);

  // Remove from owned[]
  const nextOwned = [...equipment.owned];
  nextOwned.splice(ownedIndex, 1);

  // Add Shards to items
  const currentShards = new Decimal((state.items as Record<string, Decimal>)["Shard"] ?? 0);
  const nextItems = { ...state.items, Shard: currentShards.add(shardPayout) };

  const smithXP = (state.skills.smithing ?? 0) + getSkillXP("smith_action");

  return {
    ...state,
        items: nextItems, // alias
    equipment: { ...equipment, owned: nextOwned },
    skills:    { ...state.skills, smithing: smithXP },
  };
}

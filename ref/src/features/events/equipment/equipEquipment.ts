import type { GameState } from "@/features/types/gameplay/game";
import type { EquipmentItem } from "@/features/types/gameplay/equipment";
import { createInitialEquipment } from "@/features/types/gameplay/equipment";
import { computePlayerStats } from "@/features/game/equipment";

export type EquipEquipmentAction = {
  type: "equipment.equip";
  /** Id of an owned piece to equip into its slot. */
  id: string;
};

type Options = { state: GameState; action: EquipEquipmentAction };

/**
 * equipEquipment — moves an owned piece into its slot and returns the
 * previously-equipped piece to the owned list.
 */
export function equipEquipment({ state, action }: Options): GameState {
  const equipment = state.equipment ?? createInitialEquipment();

  const ownedIndex = equipment.owned.findIndex((it) => it.id === action.id);
  if (ownedIndex < 0) throw new Error("Equipment not found in inventory");

  const incoming: EquipmentItem = equipment.owned[ownedIndex];
  const slot = incoming.slot;
  const previous = equipment.equipped[slot];

  const nextOwned = [...equipment.owned];
  nextOwned.splice(ownedIndex, 1);
  // Return the previously equipped piece to owned (unless it's a starter piece).
  if (previous && previous.tier !== "Wood") {
    nextOwned.push(previous);
  }

  const nextEquipped = { ...equipment.equipped, [slot]: incoming };
  const playerStats = computePlayerStats(nextEquipped);

  return {
    ...state,
    equipment: {
      equipped: nextEquipped,
      owned: nextOwned,
    },
    playerStats,
  };
}

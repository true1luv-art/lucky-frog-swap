/**
 * Direct selling of fish is disabled.
 * Items must be traded via the Marketplace.
 */
import { GameState, InventoryItemName } from "@/features/types/gameplay/game";

export type SellFishAction = { type: "fish.sell"; item: InventoryItemName; amount: number };

export function sellFish(_opts: { state: GameState; action: SellFishAction }): GameState {
  throw new Error("Direct selling is disabled. Use the Marketplace.");
}

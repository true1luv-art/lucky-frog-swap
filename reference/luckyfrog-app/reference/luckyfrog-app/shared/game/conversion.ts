import type { InventoryItemName } from "@/shared/types/gameplay/game";
import { CROPS, SEEDS } from "@/shared/types/gameplay/crops";
import { RESOURCES } from "@/shared/types/gameplay/resources";
import { CRAFTABLES } from "@/shared/types/gameplay/craftables";

/**
 * Tradeable items use 18 decimals (ether) for decimal-point storage.
 * Collectibles use 1 decimal (wei).
 *
 * Mirrors reference/hearthvale/features/game/lib/conversion.ts.
 */
export function getItemUnit(name: InventoryItemName): "ether" | "wei" {
  if (
    name in CROPS() ||
    name in RESOURCES ||
    name in SEEDS() ||
    name in CRAFTABLES()
  ) {
    return "ether";
  }

  // Limited items, Food, Skills, Flags
  return "wei";
}

import { InventoryItemName } from "@/shared/types/gameplay/game";

type MintedAt = Partial<Record<InventoryItemName, number>>;

type CanMintArgs = {
  itemsMintedAt?: MintedAt;
  item: InventoryItemName;
};

/**
 * How many seconds until a user can mint again.
 * 7-day cooldown enforced on the backend.
 */
export function mintCooldown({ item, itemsMintedAt }: CanMintArgs) {
  const mintedItems: MintedAt = itemsMintedAt || {};
  const lastMintedAt = mintedItems[item];

  if (!lastMintedAt) return 0;

  const diff = lastMintedAt + 7 * 24 * 60 * 60 * 1000 - Date.now();
  if (diff < 0) return 0;

  return diff / 1000;
}

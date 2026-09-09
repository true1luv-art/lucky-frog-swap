import { InventoryItemName } from "@/features/types/gameplay/game";

const LOCAL_STORAGE_KEY = "inventory.selectedItems";
const isClient = typeof window !== "undefined";

export function cacheShortcuts(item: InventoryItemName) {
  const previous = getShortcuts();
  const unique = previous.filter((name) => name !== item);
  const newItems = [item, ...unique.slice(0, 2)];
  if (isClient) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
  }
  return newItems;
}

export function getShortcuts(): InventoryItemName[] {
  if (!isClient) return [];
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!cached) return [];
  return JSON.parse(cached);
}

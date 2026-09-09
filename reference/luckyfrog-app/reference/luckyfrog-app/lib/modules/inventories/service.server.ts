/**
 * lib/modules/inventories/service.server.ts
 *
 * Public API for the inventories domain.
 * Owns the persisted LFRG balance mutation logic (apply delta and clamp).
 * All DB access is delegated to repository.server.ts.
 *
 * External callers (routes, lib/services files) must import from here —
 * never from repository.server.ts directly.
 */

import {
  getInventory,
  getOrCreateInventory,
  createInitialInventory,
  addItems,
  addInventoryItem,
  deductItems,
  deductInventoryItem,
  hasItems,
  deleteInventory,
  getPlayerForBalance,
  setPlayerBalance,
} from "./repository.server";

export type { AggregatedInventory, IInventoryItem } from "./types.server";

export {
  getInventory,
  getOrCreateInventory,
  createInitialInventory,
  addItems,
  addInventoryItem,
  deductItems,
  deductInventoryItem,
  hasItems,
  deleteInventory,
};

// ---------------------------------------------------------------------------
// Balance mutations — LFRG-backed §9.3 / §9.4
// ---------------------------------------------------------------------------

/**
 * Credits `amount` to the player's persisted Game Balance.
 */
export async function addBalance(playerId: string, amount: number): Promise<void> {
  const player = await getPlayerForBalance(playerId);
  if (!player) return;
  await setPlayerBalance(playerId, Math.max(0, (player.lfrg ?? 0) + amount));
}

/**
 * Deducts `amount` from the player's persisted Game Balance, clamped to 0.
 */
export async function deductBalance(playerId: string, amount: number): Promise<void> {
  await addBalance(playerId, -amount);
}

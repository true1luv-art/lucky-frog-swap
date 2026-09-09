"use client";

import Decimal from "decimal.js-light";
import useSWR from "swr";
import type { GameState } from "@/shared/types/gameplay";
import type { CollectibleName } from "@/shared/types/gameplay/collectibles";

export const COLLECTIBLES_API_KEY = "/api/collectibles";

export interface OwnedCollectibleCopy {
  id: string;
  collectibleNumber: number;
}

export interface CollectibleClientItem {
  name: CollectibleName;
  mintedSupply: number;
  maxSupply: number;
  remainingSupply: number;
  ownedCount: number;
  copies: OwnedCollectibleCopy[];
}

export interface CollectiblesResponse {
  success: true;
  collectibles: CollectibleClientItem[];
}

export interface ForgeResponse {
  success: true;
  state: unknown;
  collectible: {
    name: CollectibleName;
    quantity: number;
    collectibleNumbers: number[];
  };
}

export const collectiblesFetcher = async (url: string): Promise<CollectiblesResponse> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load collectibles");
  return response.json() as Promise<CollectiblesResponse>;
};

export function useCollectibles(enabled = true) {
  return useSWR<CollectiblesResponse>(enabled ? COLLECTIBLES_API_KEY : null, collectiblesFetcher, {
    revalidateOnFocus: false,
    revalidateOnMount: true,
  });
}

export function ownedAmount(inventory: Partial<Record<string, Decimal>>, item: string): Decimal {
  return new Decimal(inventory[item]?.toString() ?? 0);
}

export function maxAffordableQuantity(
  ingredients: ReadonlyArray<{ item: string; amount: Decimal }>,
  inventory: Partial<Record<string, Decimal>>,
): number {
  if (!ingredients.length) return 0;
  return Math.max(0, Math.min(...ingredients.map(({ item, amount }) =>
    ownedAmount(inventory, item).div(amount).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber(),
  )));
}

export function maxForgeQuantity(
  ingredients: ReadonlyArray<{ item: string; amount: Decimal }>,
  inventory: Partial<Record<string, Decimal>>,
  remainingSupply: number,
): number {
  return Math.max(0, Math.min(maxAffordableQuantity(ingredients, inventory), remainingSupply));
}

export function clampForgeQuantity(value: number, maximum: number): number {
  if (maximum < 1) return 0;
  if (!Number.isFinite(value)) return 1;
  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

export function forgeDisabledReason(options: {
  pending: boolean;
  remainingSupply: number;
  maximum: number;
}): string | null {
  if (options.pending) return "Forging…";
  if (options.remainingSupply <= 0) return "Sold out";
  if (options.maximum <= 0) return "Missing ingredients";
  return null;
}

function reviveDecimals(value: unknown): GameState {
  return JSON.parse(JSON.stringify(value), (_key, entry) => {
    if (entry && typeof entry === "object" && "__decimal" in entry) {
      return new Decimal((entry as { __decimal: string }).__decimal);
    }
    return entry;
  }) as GameState;
}

export async function forgeCollectible(options: {
  name: CollectibleName;
  quantity: number;
  reconcile: (state: GameState) => void;
  refreshFarm: () => Promise<void>;
  refreshCollectibles: () => Promise<unknown>;
}): Promise<ForgeResponse> {
  const response = await fetch("/api/farm/action", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "collectible.crafted",
      payload: { name: options.name, quantity: options.quantity },
      createdAt: Date.now(),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: string };
    if (response.status === 422) {
      await options.refreshFarm();
      await options.refreshCollectibles();
    }
    throw new Error(error.error ?? "Forge failed");
  }

  const result = await response.json() as ForgeResponse;
  if (!result.success || !result.state) throw new Error("Invalid forge response");
  options.reconcile(reviveDecimals(result.state));
  await options.refreshCollectibles();
  return result;
}

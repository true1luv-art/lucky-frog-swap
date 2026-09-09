import Decimal from "decimal.js-light";
import { describe, expect, it } from "vitest";

import {
  COLLECTIBLE_BONUS_AMOUNT,
  COLLECTIBLE_MAX_SUPPLY,
  COLLECTIBLES,
  isCollectibleName,
} from "@/shared/data/collectibles";
import { COLLECTIBLE_NAMES } from "@/shared/types/gameplay/collectibles";
import type { InventoryItemName } from "@/shared/types/gameplay/game";

const CANONICAL_INVENTORY_NAMES = new Set<InventoryItemName>([
  "Potato", "Carrot", "Cabbage", "Pumpkin", "Beetroot", "Parsnip", "Radish",
  "Cauliflower", "Wheat", "Kale", "Wood", "Stone", "Iron", "Gold", "Egg", "Milk", "Wool",
  "Anchovy", "Sardine", "Tilapia", "Herring", "Trout", "Sea Bass", "Mackerel", "Salmon",
  "Roasted Potato", "Carrot Stew", "Cabbage Roll", "Pumpkin Soup", "Beetroot Salad",
  "Parsnip Porridge", "Radish Skewers",
]);

describe("COLLECTIBLES", () => {
  it("defines exactly the six canonical collectible names", () => {
    expect(Object.keys(COLLECTIBLES)).toEqual([...COLLECTIBLE_NAMES]);
    expect(COLLECTIBLE_NAMES).toHaveLength(6);
  });

  it.each(COLLECTIBLE_NAMES)("defines valid static configuration for %s", (name) => {
    const collectible = COLLECTIBLES[name];

    expect(collectible.name).toBe(name);
    expect(collectible.maxSupply).toBe(COLLECTIBLE_MAX_SUPPLY);
    expect(collectible.maxSupply).toBe(1_500);
    expect(collectible.effect.amount).toBe(COLLECTIBLE_BONUS_AMOUNT);
    expect(collectible.effect.amount).toBe(0.1);
    expect(collectible.image).toMatch(/^\/assets\/collectibles\/.+\.png$/);
    expect(collectible.ingredients.length).toBeGreaterThan(0);
    expect(collectible).not.toHaveProperty("price");
    expect(collectible).not.toHaveProperty("balance");
    expect(collectible).not.toHaveProperty("lfrg");
  });

  it("uses only canonical inventory ingredients with positive Decimal quantities", () => {
    for (const collectible of Object.values(COLLECTIBLES)) {
      for (const ingredient of collectible.ingredients) {
        expect(CANONICAL_INVENTORY_NAMES.has(ingredient.item)).toBe(true);
        expect(ingredient.amount).toBeInstanceOf(Decimal);
        expect(ingredient.amount.gt(0)).toBe(true);
      }
    }
  });

  it("recognizes only canonical collectible names", () => {
    for (const name of COLLECTIBLE_NAMES) expect(isCollectibleName(name)).toBe(true);
    expect(isCollectibleName("Firewood")).toBe(false);
    expect(isCollectibleName("Harvest Scarecrow Copy")).toBe(false);
  });
});

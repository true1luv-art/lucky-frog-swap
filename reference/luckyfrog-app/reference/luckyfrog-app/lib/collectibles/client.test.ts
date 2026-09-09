import Decimal from "decimal.js-light";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clampForgeQuantity, forgeCollectible, forgeDisabledReason, maxForgeQuantity } from "./client";

const ingredients = [
  { item: "Wood", amount: new Decimal(10) },
  { item: "Stone", amount: new Decimal(4) },
];

describe("collectible client helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("bounds forge quantity by affordability and remaining supply", () => {
    expect(maxForgeQuantity(ingredients, { Wood: new Decimal(49), Stone: new Decimal(100) }, 20)).toBe(4);
    expect(maxForgeQuantity(ingredients, { Wood: new Decimal(100), Stone: new Decimal(100) }, 3)).toBe(3);
    expect(clampForgeQuantity(99, 3)).toBe(3);
    expect(clampForgeQuantity(-2, 3)).toBe(1);
    expect(clampForgeQuantity(1, 0)).toBe(0);
  });

  it("derives pending, sold-out, and unaffordable labels", () => {
    expect(forgeDisabledReason({ pending: true, remainingSupply: 2, maximum: 1 })).toBe("Forging…");
    expect(forgeDisabledReason({ pending: false, remainingSupply: 0, maximum: 0 })).toBe("Sold out");
    expect(forgeDisabledReason({ pending: false, remainingSupply: 2, maximum: 0 })).toBe("Missing ingredients");
    expect(forgeDisabledReason({ pending: false, remainingSupply: 2, maximum: 1 })).toBeNull();
  });

  it("reconciles then refreshes collectibles after success", async () => {
    const order: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, state: { inventory: {} }, collectible: {} }) }));
    await forgeCollectible({
      name: "Harvest Scarecrow", quantity: 1,
      reconcile: () => order.push("reconcile"),
      refreshFarm: async () => { order.push("farm"); },
      refreshCollectibles: async () => { order.push("collectibles"); },
    });
    expect(order).toEqual(["reconcile", "collectibles"]);
  });

  it("refreshes farm then collectibles before surfacing a 422", async () => {
    const order: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: "Sold out" }) }));
    await expect(forgeCollectible({
      name: "Harvest Scarecrow", quantity: 1,
      reconcile: () => order.push("reconcile"),
      refreshFarm: async () => { order.push("farm"); },
      refreshCollectibles: async () => { order.push("collectibles"); },
    })).rejects.toThrow("Sold out");
    expect(order).toEqual(["farm", "collectibles"]);
  });
});

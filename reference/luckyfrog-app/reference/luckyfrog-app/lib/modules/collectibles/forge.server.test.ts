import { beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECTIBLES } from "@/shared/data/collectibles";
import { COLLECTIBLE_NAMES } from "@/shared/types/gameplay/collectibles";

const mocks = vi.hoisted(() => {
  const session = {
    withTransaction: vi.fn(),
    endSession: vi.fn(),
  };
  return {
    session,
    connectDatabase: vi.fn(),
    updateOne: vi.fn(),
    reserve: vi.fn(),
    insert: vi.fn(),
    supply: vi.fn(),
  };
});

vi.mock("@/lib/config/database", () => ({
  connectDatabase: mocks.connectDatabase,
}));

vi.mock("@/lib/modules/inventories/model.server", () => ({
  InventoryModel: { updateOne: mocks.updateOne },
}));

vi.mock("./repository.server", () => ({
  reserveCollectibleMintRange: mocks.reserve,
  insertReservedCollectibles: mocks.insert,
  getCollectibleSupply: mocks.supply,
}));

import {
  assertCraftCollectibleAction,
  craftCollectible,
  getCollectibleRequirements,
} from "./forge.server";

describe("authoritative collectible forging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDatabase.mockResolvedValue({
      startSession: vi.fn().mockResolvedValue(mocks.session),
    });
    mocks.session.withTransaction.mockImplementation(async (callback) => callback());
    mocks.session.endSession.mockResolvedValue(undefined);
    mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.reserve.mockResolvedValue({ first: 9, last: 10 });
    mocks.insert.mockResolvedValue([
      { collectible_number: 9 },
      { collectible_number: 10 },
    ]);
    mocks.supply.mockResolvedValue({
      name: "Forester's Totem",
      mintedSupply: 10,
      maxSupply: 1500,
      remainingSupply: 1490,
    });
  });

  it("accepts only a known name and positive integer quantity", () => {
    expect(() => assertCraftCollectibleAction(null)).toThrow("Invalid");
    expect(() =>
      assertCraftCollectibleAction({
        type: "collectible.crafted",
        name: "Forged Client Payload",
        quantity: 1,
      }),
    ).toThrow("Unknown collectible");

    for (const quantity of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        assertCraftCollectibleAction({
          type: "collectible.crafted",
          name: "Forester's Totem",
          quantity,
        }),
      ).toThrow("positive integer");
    }
  });

  it.each(COLLECTIBLE_NAMES)("multiplies the trusted %s recipe for bulk forging", (name) => {
    const requirements = getCollectibleRequirements(name, 3);
    for (const ingredient of COLLECTIBLES[name].ingredients) {
      expect(requirements[ingredient.item]).toBe(ingredient.amount.mul(3).toNumber());
    }
    expect(Object.keys(requirements)).toHaveLength(COLLECTIBLES[name].ingredients.length);
  });

  it("deducts exact requirements and mints in the same session", async () => {
    const result = await craftCollectible(" wallet ", {
      type: "collectible.crafted",
      name: "Forester's Totem",
      quantity: 2,
      ingredients: [{ item: "Wood", amount: 1 }],
      balance: 999999,
    });

    expect(mocks.updateOne).toHaveBeenCalledTimes(4);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { owner: "wallet", item: "Wood", amount: { $gte: 15400 } },
      { $inc: { amount: -15400 } },
      { session: mocks.session },
    );
    expect(mocks.reserve).toHaveBeenCalledWith(
      "Forester's Totem",
      2,
      mocks.session,
    );
    expect(mocks.insert).toHaveBeenCalledWith(
      "wallet",
      "Forester's Totem",
      expect.any(Object),
      mocks.session,
    );
    expect(result).toMatchObject({
      collectibleNumbers: [9, 10],
      quantity: 2,
      supply: { remainingSupply: 1490 },
    });
    expect(mocks.session.endSession).toHaveBeenCalledOnce();
  });

  it("aborts before supply reservation when any ingredient is insufficient", async () => {
    mocks.updateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 0 });

    await expect(
      craftCollectible("wallet", {
        type: "collectible.crafted",
        name: "Forester's Totem",
        quantity: 1,
      }),
    ).rejects.toThrow("Insufficient ingredient");

    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.supply).not.toHaveBeenCalled();
    expect(mocks.session.endSession).toHaveBeenCalledOnce();
  });

  it("propagates sold-out failures so withTransaction rolls deductions back", async () => {
    mocks.reserve.mockRejectedValue(new Error("Forester's Totem is sold out"));

    await expect(
      craftCollectible("wallet", {
        type: "collectible.crafted",
        name: "Forester's Totem",
        quantity: 1,
      }),
    ).rejects.toThrow("sold out");

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.supply).not.toHaveBeenCalled();
  });

  it("supports driver transaction retries without changing trusted inputs", async () => {
    mocks.session.withTransaction.mockImplementation(async (callback) => {
      await callback();
      await callback();
    });

    await craftCollectible("wallet", {
      type: "collectible.crafted",
      name: "Forester's Totem",
      quantity: 2,
    });

    expect(mocks.reserve).toHaveBeenCalledTimes(2);
    expect(mocks.reserve).toHaveBeenNthCalledWith(
      2,
      "Forester's Totem",
      2,
      mocks.session,
    );
  });

  it("rejects partial mint insertion and never reads post-commit supply", async () => {
    mocks.insert.mockResolvedValue([{ collectible_number: 9 }]);

    await expect(
      craftCollectible("wallet", {
        type: "collectible.crafted",
        name: "Forester's Totem",
        quantity: 2,
      }),
    ).rejects.toThrow("did not complete");

    expect(mocks.supply).not.toHaveBeenCalled();
  });
});

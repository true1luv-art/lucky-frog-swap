import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDatabase: vi.fn(),
  collectible: {
    find: vi.fn(),
    updateOne: vi.fn(),
  },
  counter: {
    findOne: vi.fn(),
    find: vi.fn(),
    updateOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock("@/lib/config/database", () => ({
  connectDatabase: mocks.connectDatabase,
}));

vi.mock("./model.server", () => ({
  CollectibleModel: mocks.collectible,
  CollectibleCounterModel: mocks.counter,
}));

import {
  getAllCollectibleSupplies,
  getCollectibleSupply,
  getOwnedCollectibleNames,
  reserveCollectibleMintRange,
  settleCollectibleMarketplaceSale,
} from "./repository.server";

const session = {} as never;

describe("collectibles repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDatabase.mockResolvedValue(undefined);
  });

  it("reports zero supply before a counter exists", async () => {
    mocks.counter.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await expect(getCollectibleSupply("Harvest Scarecrow")).resolves.toEqual({
      name: "Harvest Scarecrow",
      mintedSupply: 0,
      maxSupply: 1500,
      remainingSupply: 1500,
    });
  });

  it("returns all six supplies, filling missing counters", async () => {
    mocks.counter.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { name: "Harvest Scarecrow", mintedSupply: 12, maxSupply: 1500 },
      ]),
    });

    const supplies = await getAllCollectibleSupplies();
    expect(supplies).toHaveLength(6);
    expect(supplies[0]).toMatchObject({ mintedSupply: 12, remainingSupply: 1488 });
    expect(supplies.slice(1).every((supply) => supply.remainingSupply === 1500)).toBe(true);
  });

  it("deduplicates and orders owner names by the canonical catalog", async () => {
    const lean = vi.fn().mockResolvedValue([
      { name: "Husbandry Bell" },
      { name: "Harvest Scarecrow" },
      { name: "Harvest Scarecrow" },
    ]);
    const select = vi.fn().mockReturnValue({ lean });
    mocks.collectible.find.mockReturnValue({ select });

    await expect(getOwnedCollectibleNames("  wallet  ")).resolves.toEqual([
      "Harvest Scarecrow",
      "Husbandry Bell",
    ]);
    expect(mocks.collectible.find).toHaveBeenCalledWith({ owner: "wallet" });
    expect(select).toHaveBeenCalledWith({ name: 1, _id: 0 });
  });

  it("atomically reserves contiguous per-name mint numbers in the session", async () => {
    mocks.counter.updateOne.mockResolvedValue({ acknowledged: true });
    mocks.counter.findOneAndUpdate.mockResolvedValue({ mintedSupply: 12 });

    await expect(
      reserveCollectibleMintRange("Fisher's Shrine", 3, session),
    ).resolves.toEqual({
      first: 10,
      last: 12,
    });

    expect(mocks.counter.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ mintedSupply: { $lte: 1497 } }),
      { $inc: { mintedSupply: 3 } },
      expect.objectContaining({ session }),
    );
  });

  it("admits the 1,500th mint and rejects the 1,501st", async () => {
    mocks.counter.updateOne.mockResolvedValue({ acknowledged: true });
    mocks.counter.findOneAndUpdate
      .mockResolvedValueOnce({ mintedSupply: 1500 })
      .mockResolvedValueOnce(null);

    await expect(
      reserveCollectibleMintRange("Miner's Monument", 1, session),
    ).resolves.toEqual({ first: 1500, last: 1500 });
    await expect(
      reserveCollectibleMintRange("Miner's Monument", 1, session),
    ).rejects.toThrow("Miner's Monument is sold out");
  });

  it("allows only the available final slot across concurrent reservations", async () => {
    mocks.counter.updateOne.mockResolvedValue({ acknowledged: true });
    mocks.counter.findOneAndUpdate
      .mockResolvedValueOnce({ mintedSupply: 1500 })
      .mockResolvedValueOnce(null);

    const results = await Promise.allSettled([
      reserveCollectibleMintRange("Husbandry Bell", 1, session),
      reserveCollectibleMintRange("Husbandry Bell", 1, session),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("rejects sold-out and invalid reservations", async () => {
    mocks.counter.updateOne.mockResolvedValue({ acknowledged: true });
    mocks.counter.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      reserveCollectibleMintRange("Miner's Monument", 1, session),
    ).rejects.toThrow("Miner's Monument is sold out");
    await expect(
      reserveCollectibleMintRange("Miner's Monument", 1.5, session),
    ).rejects.toThrow("positive integer");
  });

  it("changes ownership only through listed and locked marketplace settlement", async () => {
    mocks.collectible.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await expect(
      settleCollectibleMarketplaceSale("asset-id", " seller ", " buyer ", session),
    ).resolves.toBe(true);

    expect(mocks.collectible.updateOne).toHaveBeenCalledWith(
      {
        _id: "asset-id",
        owner: "seller",
        "market.listed": true,
        "market.locked": true,
      },
      {
        $set: {
          owner: "buyer",
          market: expect.objectContaining({ listed: false, locked: false, price: 0 }),
        },
      },
      { session },
    );
  });
});

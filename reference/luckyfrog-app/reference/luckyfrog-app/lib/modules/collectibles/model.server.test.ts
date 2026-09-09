import { describe, expect, it } from "vitest";
import {
  CollectibleCounterModel,
  CollectibleModel,
} from "./model.server";

function hasIndex(
  indexes: Array<[Record<string, number>, Record<string, unknown>]>,
  expected: Record<string, number>,
  unique = false,
): boolean {
  return indexes.some(([fields, options]) =>
    JSON.stringify(fields) === JSON.stringify(expected) &&
    (!unique || options.unique === true),
  );
}

describe("CollectibleModel", () => {
  it("uses the collectibles collection and required unique indexes", () => {
    expect(CollectibleModel.collection.name).toBe("collectibles");
    const indexes = CollectibleModel.schema.indexes() as Array<
      [Record<string, number>, Record<string, unknown>]
    >;
    expect(hasIndex(indexes, { name: 1, collectible_number: 1 }, true)).toBe(true);
    expect(hasIndex(indexes, { owner: 1, name: 1 })).toBe(true);
    expect(hasIndex(indexes, { "market.listed": 1, "market.price": 1 })).toBe(true);
    expect(hasIndex(indexes, { "market.hash": 1 })).toBe(true);
  });

  it("hydrates equipment-compatible unlisted market defaults", () => {
    const collectible = new CollectibleModel({
      collectible_number: 1,
      owner: "owner-wallet",
      name: "Harvest Scarecrow",
      system: "harvesting",
      image: "/assets/collectibles/harvest-scarecrow.png",
    });

    expect(collectible.market).toMatchObject({
      listed: false,
      price: 0,
      seller: null,
      created: null,
      expires: null,
      sold: false,
      locked: false,
    });
  });

  it("rejects invalid names and per-name numbers above supply", async () => {
    const invalid = new CollectibleModel({
      collectible_number: 1501,
      owner: "owner-wallet",
      name: "Unknown Collectible",
      system: "harvesting",
      image: "/invalid.png",
    });
    await expect(invalid.validate()).rejects.toMatchObject({
      errors: {
        name: expect.anything(),
        collectible_number: expect.anything(),
      },
    });
  });
});

describe("collectible counters", () => {
  it("uses dedicated per-name counter collection", () => {
    expect(CollectibleCounterModel.collection.name).toBe("collectible_counters");
  });

  it("fixes every per-name counter max supply at 1500", async () => {
    const counter = new CollectibleCounterModel({ name: "Fisher's Shrine" });
    expect(counter.mintedSupply).toBe(0);
    expect(counter.maxSupply).toBe(1500);

    const invalid = new CollectibleCounterModel({
      name: "Fisher's Shrine",
      mintedSupply: 1501,
      maxSupply: 1500,
    });
    await expect(invalid.validate()).rejects.toMatchObject({
      errors: { mintedSupply: expect.anything() },
    });
  });
});

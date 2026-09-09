import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collectibleFindById: vi.fn(),
  collectibleUpdateOne: vi.fn(),
  equipmentFindById: vi.fn(),
  countActive: vi.fn(),
  generateHash: vi.fn(() => "collectible-listing-hash"),
}));

vi.mock("@/lib/modules/collectibles/model.server", () => ({
  CollectibleModel: {
    findById: mocks.collectibleFindById,
    updateOne: mocks.collectibleUpdateOne,
  },
}));

vi.mock("@/lib/modules/equipments/model.server", () => ({
  EquipmentModel: {
    findById: mocks.equipmentFindById,
    updateOne: vi.fn(),
  },
}));

vi.mock("@/lib/modules/marketplace/query.server", () => ({
  countActiveListingsBySeller: mocks.countActive,
}));

vi.mock("@/lib/modules/marketplace/hash.server", () => ({
  generateListingHash: mocks.generateHash,
}));

import { listUniqueAsset } from "./list-unique";

function collectible(overrides: Record<string, unknown> = {}) {
  return {
    _id: "collectible-id",
    owner: "seller-wallet",
    name: "Harvest Scarecrow",
    rarity: "legendary",
    system: "harvesting",
    market: { listed: false },
    ...overrides,
  };
}

function mockCollectible(document: Record<string, unknown> | null) {
  mocks.collectibleFindById.mockReturnValue({
    lean: vi.fn().mockResolvedValue(document),
  });
}

describe("listUniqueAsset collectible support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countActive.mockResolvedValue(0);
    mocks.collectibleUpdateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("lists an owned collectible using canonical document metadata", async () => {
    mockCollectible(collectible());

    const result = await listUniqueAsset({
      sellerId: "seller-wallet",
      assetType: "collectible",
      assetId: "collectible-id",
      price: 25,
    });

    expect(result).toMatchObject({
      status: "ok",
      assetType: "collectible",
      assetName: "Harvest Scarecrow",
      listingId: "collectible-listing-hash",
    });
    expect(mocks.collectibleUpdateOne).toHaveBeenCalledWith(
      {
        _id: "collectible-id",
        owner: "seller-wallet",
        "market.listed": { $ne: true },
      },
      {
        $set: {
          market: expect.objectContaining({
            listed: true,
            seller: "seller-wallet",
            price: 25,
            hash: "collectible-listing-hash",
          }),
        },
      },
    );
    expect(mocks.equipmentFindById).not.toHaveBeenCalled();
  });

  it("rejects non-owners and already-listed collectibles", async () => {
    mockCollectible(collectible({ owner: "another-wallet" }));
    await expect(listUniqueAsset({
      sellerId: "seller-wallet",
      assetType: "collectible",
      assetId: "collectible-id",
      price: 25,
    })).resolves.toEqual({ status: "not-owner" });

    mockCollectible(collectible({ market: { listed: true } }));
    await expect(listUniqueAsset({
      sellerId: "seller-wallet",
      assetType: "collectible",
      assetId: "collectible-id",
      price: 25,
    })).resolves.toEqual({ status: "already-listed" });
  });

  it("rejects a concurrent duplicate listing update", async () => {
    mockCollectible(collectible());
    mocks.collectibleUpdateOne.mockResolvedValue({ matchedCount: 0 });

    await expect(listUniqueAsset({
      sellerId: "seller-wallet",
      assetType: "collectible",
      assetId: "collectible-id",
      price: 25,
    })).resolves.toEqual({ status: "already-listed" });
  });
});

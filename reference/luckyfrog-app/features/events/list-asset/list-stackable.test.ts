import { describe, it, expect, vi, beforeEach } from "vitest";
import { listStackableAsset } from "./list-stackable";

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/features/game/marketplace", () => ({
  MARKETPLACE_CONFIG: {
    maxActiveListings: 10,
    minPrice:          1,
    maxPrice:          1_000_000,
  },
  validateListingParams: vi.fn(),
  TRADABLE_ASSET_TYPES: ["resource", "seed", "food", "fish", "crafting_material"],
}));

vi.mock("@/lib/modules/items/repository.server", () => ({
  setMarketBackRef: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/modules/items/model.server", () => ({
  ItemModel: {
    findOne: vi.fn(),
  },
}));

vi.mock("@/lib/modules/listings/repository.server", () => ({
  insertListing:                vi.fn(),
  findActiveListingBySellerItem: vi.fn().mockResolvedValue(null),
  countActiveListingsBySeller:  vi.fn().mockResolvedValue(0),
}));

vi.mock("@/features/events/list-asset/item-asset-type", () => ({
  getItemAssetType: vi.fn().mockReturnValue("resource"),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { ItemModel }                  from "@/lib/modules/items/model.server";
import * as listingsRepo              from "@/lib/modules/listings/repository.server";
import mongoose                       from "mongoose";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SELLER = "0xseller000000000000000000000000000000001";

function mockInventory(amount = 100) {
  vi.mocked(ItemModel.findOne).mockResolvedValue({
    owner:  SELLER,
    item:   "Iron Ore",
    amount,
    market: null,
  } as never);
}

function mockInsertListing() {
  const fakeId = new mongoose.Types.ObjectId();
  vi.mocked(listingsRepo.insertListing).mockResolvedValue({
    _id:          fakeId,
    seller:       SELLER,
    item:         "Iron Ore",
    quantity:     50,
    pricePerUnit: 5,
    status:       "active",
    createdAt:    new Date(),
  } as never);
  return fakeId;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("listStackableAsset", () => {
  it("returns ok with listingId on a valid listing", async () => {
    mockInventory();
    const fakeId = mockInsertListing();

    const result = await listStackableAsset({
      sellerId: SELLER, itemName: "Iron Ore", quantity: 50, pricePerUnit: 5,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.listingId).toBe(fakeId.toString());
      expect(result.quantity).toBe(50);
    }
  });

  it("returns item-not-found when the inventory document does not exist", async () => {
    vi.mocked(ItemModel.findOne).mockResolvedValue(null);

    const result = await listStackableAsset({
      sellerId: SELLER, itemName: "Iron Ore", quantity: 10, pricePerUnit: 5,
    });

    expect(result.status).toBe("item-not-found");
  });

  it("returns insufficient-quantity when amount is below requested", async () => {
    mockInventory(5);

    const result = await listStackableAsset({
      sellerId: SELLER, itemName: "Iron Ore", quantity: 50, pricePerUnit: 5,
    });

    expect(result.status).toBe("insufficient-quantity");
  });

  it("returns item-already-listed when an active listing exists for the item", async () => {
    mockInventory(100);
    vi.mocked(listingsRepo.findActiveListingBySellerItem).mockResolvedValue({
      _id:    new mongoose.Types.ObjectId(),
      status: "active",
    } as never);

    const result = await listStackableAsset({
      sellerId: SELLER, itemName: "Iron Ore", quantity: 10, pricePerUnit: 5,
    });

    expect(result.status).toBe("item-already-listed");
  });

  it("returns listing-limit-reached when the seller is at the cap", async () => {
    mockInventory();
    vi.mocked(listingsRepo.countActiveListingsBySeller).mockResolvedValue(10);

    const result = await listStackableAsset({
      sellerId: SELLER, itemName: "Iron Ore", quantity: 10, pricePerUnit: 5,
    });

    expect(result.status).toBe("listing-limit-reached");
  });

  it("returns invalid-quantity for a zero quantity", async () => {
    const result = await listStackableAsset({
      sellerId: SELLER, itemName: "Iron Ore", quantity: 0, pricePerUnit: 5,
    });

    expect(result.status).toBe("invalid-quantity");
  });
});

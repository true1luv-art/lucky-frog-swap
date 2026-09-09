import { describe, it, expect, vi, beforeEach } from "vitest";
import { cancelListing } from "./action";

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/modules/listings/repository.server", () => ({
  findListingById:   vi.fn(),
  cancelListing:     vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/modules/items/repository.server", () => ({
  clearMarketBackRef: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import * as listingsRepo  from "@/lib/modules/listings/repository.server";
import mongoose           from "mongoose";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SELLER     = "0xseller000000000000000000000000000000001";
const LISTING_ID = new mongoose.Types.ObjectId().toString();

function mockActiveListing(overrides: Record<string, unknown> = {}) {
  vi.mocked(listingsRepo.findListingById).mockResolvedValue({
    _id:          new mongoose.Types.ObjectId(LISTING_ID),
    seller:       SELLER,
    item:         "Iron Ore",
    quantity:     50,
    pricePerUnit: 10,
    status:       "active",
    createdAt:    new Date(),
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("cancelListing", () => {
  it("returns ok and refunds quantity to inventory", async () => {
    mockActiveListing();

    const result = await cancelListing({ playerId: SELLER, listingId: LISTING_ID });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.listingId).toBe(LISTING_ID);
      expect(result.quantityReturned).toBe(50);
    }
  });

  it("returns listing-not-found when no listing document exists", async () => {
    vi.mocked(listingsRepo.findListingById).mockResolvedValue(null);

    const result = await cancelListing({ playerId: SELLER, listingId: LISTING_ID });

    expect(result.status).toBe("listing-not-found");
  });

  it("returns listing-not-active when the listing is already sold", async () => {
    mockActiveListing({ status: "sold" });

    const result = await cancelListing({ playerId: SELLER, listingId: LISTING_ID });

    expect(result.status).toBe("listing-not-active");
  });

  it("returns not-seller when a different player tries to cancel", async () => {
    mockActiveListing();

    const result = await cancelListing({ playerId: "0xotherseller", listingId: LISTING_ID });

    expect(result.status).toBe("not-seller");
  });

  it("allows force-cancel by bypassing the seller check", async () => {
    mockActiveListing();

    const result = await cancelListing({ playerId: "0xanyone", listingId: LISTING_ID, force: true });

    expect(result.status).toBe("ok");
  });
});

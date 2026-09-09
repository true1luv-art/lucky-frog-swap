import { describe, it, expect, vi, beforeEach } from "vitest";
import { expireListing, expireAllDueListings } from "./action";

// Delegate to cancelListing — mock it entirely.
vi.mock("@/features/events/cancel-listing/action", () => ({
  cancelListing: vi.fn(),
}));

vi.mock("@/lib/modules/items/model.server", () => ({
  ItemModel: {
    find:   vi.fn(),
    select: vi.fn(),
  },
}));

import { cancelListing } from "@/features/events/cancel-listing/action";
import { ItemModel } from "@/lib/modules/items/model.server";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("expireListing", () => {
  it("returns ok when cancelListing succeeds", async () => {
    vi.mocked(cancelListing).mockResolvedValue({
      status:           "ok",
      listingId:        "hash1",
      assetType:        "resource",
      assetName:        "Iron Ore",
      sellerId:         "0xseller",
      quantityReturned: 10,
    });

    const result = await expireListing("hash1");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.quantityReturned).toBe(10);
    }
  });

  it("returns listing-not-found when cancelListing says listing-not-found", async () => {
    vi.mocked(cancelListing).mockResolvedValue({ status: "listing-not-found" });

    const result = await expireListing("ghost-hash");

    expect(result.status).toBe("listing-not-found");
  });

  it("returns listing-already-resolved when listing is no longer active", async () => {
    vi.mocked(cancelListing).mockResolvedValue({ status: "listing-not-active" });

    const result = await expireListing("done-hash");

    expect(result.status).toBe("listing-already-resolved");
  });

  it("passes force:true and logType:listing_expired to cancelListing", async () => {
    vi.mocked(cancelListing).mockResolvedValue({
      status: "ok", listingId: "h", assetType: "resource", assetName: "Stone", sellerId: "0x1", quantityReturned: 5,
    });

    await expireListing("h");

    expect(cancelListing).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, logType: "listing_expired" }),
    );
  });
});

describe("expireAllDueListings", () => {
  it("processes all due hashes and returns a batch summary", async () => {
    (ItemModel.find as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { market: { hash: "h1" } },
          { market: { hash: "h2" } },
        ]),
      }),
    });

    vi.mocked(cancelListing).mockResolvedValue({
      status: "ok", listingId: "hX", assetType: "resource", assetName: "Stone", sellerId: "0x1",
    });

    const result = await expireAllDueListings();

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("counts a failed item when cancelListing throws", async () => {
    (ItemModel.find as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ market: { hash: "bad" } }]),
      }),
    });

    vi.mocked(cancelListing).mockRejectedValue(new Error("DB error"));

    const result = await expireAllDueListings();

    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toBe("DB error");
  });
});

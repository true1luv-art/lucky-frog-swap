import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getWallet: vi.fn(), getSupplies: vi.fn(), getOwned: vi.fn() }));
vi.mock("@/lib/api/get-wallet", () => ({ getWallet: mocks.getWallet }));
vi.mock("@/lib/modules/collectibles/service.server", () => ({
  getAllCollectibleSupplies: mocks.getSupplies,
  getCollectiblesByOwner: mocks.getOwned,
}));

import { GET } from "./route";
import { COLLECTIBLE_NAMES } from "@/shared/types/gameplay/collectibles";

describe("GET /api/collectibles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWallet.mockResolvedValue("wallet-1");
    mocks.getSupplies.mockResolvedValue([]);
    mocks.getOwned.mockResolvedValue([]);
  });

  it("requires authentication", async () => {
    mocks.getWallet.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/collectibles?wallet=other"));
    expect(response.status).toBe(401);
    expect(mocks.getOwned).not.toHaveBeenCalled();
  });

  it("returns canonical safe projections with MongoDB IDs and grouped copies", async () => {
    mocks.getSupplies.mockResolvedValue([{ name: "Miner's Monument", mintedSupply: 11, maxSupply: 1500, remainingSupply: 1489 }]);
    mocks.getOwned.mockResolvedValue([
      { name: "Miner's Monument", owner: "wallet-1", _id: "66abc789", collectible_number: 9, market: { listed: true } },
      { name: "Miner's Monument", owner: "wallet-1", _id: "66abc123", collectible_number: 8, market: { listed: false } },
    ]);
    const response = await GET(new Request("http://localhost/api/collectibles?wallet=other"));
    const body = await response.json();

    expect(body.collectibles.map((item: { name: string }) => item.name)).toEqual(COLLECTIBLE_NAMES);
    expect(body.collectibles[0]).toMatchObject({ mintedSupply: 0, maxSupply: 1500, remainingSupply: 1500, ownedCount: 0, copies: [] });
    expect(body.collectibles.find((item: { name: string }) => item.name === "Miner's Monument")).toEqual({
      name: "Miner's Monument", mintedSupply: 11, maxSupply: 1500, remainingSupply: 1489, ownedCount: 2,
      copies: [{ id: "66abc123", collectibleNumber: 8 }, { id: "66abc789", collectibleNumber: 9 }],
    });
    expect(JSON.stringify(body)).not.toContain("owner");
    expect(JSON.stringify(body)).not.toContain("market");
    expect(mocks.getOwned).toHaveBeenCalledWith("wallet-1");
  });
});

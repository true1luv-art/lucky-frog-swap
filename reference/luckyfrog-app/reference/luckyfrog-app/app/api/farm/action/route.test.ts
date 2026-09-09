import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWallet: vi.fn(),
  getFarm: vi.fn(),
  getInventory: vi.fn(),
  findPlayer: vi.fn(),
  buildState: vi.fn(),
  persist: vi.fn(),
  forge: vi.fn(),
  getOwnedCollectibleNames: vi.fn(),
}));

vi.mock("@/lib/api/get-wallet", () => ({ getWallet: mocks.getWallet }));
vi.mock("@/lib/modules/farms/repository.server", () => ({
  getOrCreateFarm: mocks.getFarm,
}));
vi.mock("@/lib/modules/inventories/repository.server", () => ({
  getOrCreateInventory: mocks.getInventory,
}));
vi.mock("@/lib/modules/players/repository.server", () => ({
  findPlayerByWallet: mocks.findPlayer,
}));
vi.mock("@/lib/events/farm-action/build-state", () => ({
  buildServerGameState: mocks.buildState,
}));
vi.mock("@/lib/events/farm-action/persist", () => ({
  persistFarmChanges: mocks.persist,
}));
vi.mock("@/lib/modules/collectibles/service.server", () => ({
  craftCollectible: mocks.forge,
  getOwnedCollectibleNames: mocks.getOwnedCollectibleNames,
}));
vi.mock("@/lib/modules/farms/achievements", () => ({
  checkAndGrantAchievements: vi.fn((state) => state),
}));
vi.mock("@/lib/events/craft/craft", () => ({ craft: vi.fn() }));
vi.mock("@/lib/events", () => ({ processGameEvent: vi.fn() }));
vi.mock("@/lib/events/farm-action/validate", () => ({
  serverPlant: vi.fn(),
  serverHarvest: vi.fn(),
  serverChop: vi.fn(),
  serverMineStone: vi.fn(),
  serverMineIron: vi.fn(),
  serverMineGold: vi.fn(),
  serverFeedChicken: vi.fn(),
  serverFeedCow: vi.fn(),
  serverFeedSheep: vi.fn(),
  serverCollectEgg: vi.fn(),
  serverCollectMilk: vi.fn(),
  serverCollectWool: vi.fn(),
  serverCatchFish: vi.fn(),
  serverStartCooking: vi.fn(),
  serverCollectCooked: vi.fn(),
}));

import { POST } from "./route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/farm/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/farm/action collectible forging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWallet.mockResolvedValue("wallet");
    mocks.getFarm.mockResolvedValue({ id: "farm" });
    mocks.findPlayer.mockResolvedValue({ wallet: "wallet", lfrg: 321 });
    mocks.getInventory
      .mockResolvedValueOnce({ playerId: "wallet", items: { Wood: 15400 } })
      .mockResolvedValueOnce({ playerId: "wallet", items: { Wood: 0 } });
    mocks.getOwnedCollectibleNames
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["Forester's Totem"]);
    mocks.buildState
      .mockReturnValueOnce({ inventory: { Wood: 15400 }, balance: 321, skills: { cooking: 44 } })
      .mockReturnValueOnce({ inventory: { Wood: 0 }, balance: 321, skills: { cooking: 44 } });
    mocks.forge.mockResolvedValue({
      name: "Forester's Totem",
      quantity: 2,
      collectibleNumbers: [9, 10],
      supply: {
        name: "Forester's Totem",
        mintedSupply: 10,
        maxSupply: 1500,
        remainingSupply: 1490,
      },
    });
  });

  it("returns authoritative mint metadata and refreshed inventory state", async () => {
    const response = await POST(
      request({
        type: "collectible.crafted",
        payload: {
          name: "Forester's Totem",
          quantity: 2,
          ingredients: [{ item: "Wood", amount: 1 }],
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.forge).toHaveBeenCalledWith("wallet", {
      type: "collectible.crafted",
      name: "Forester's Totem",
      quantity: 2,
      ingredients: [{ item: "Wood", amount: 1 }],
    });
    expect(body).toMatchObject({
      success: true,
      state: { inventory: { Wood: 0 }, balance: 321, skills: { cooking: 44 } },
      collectible: {
        collectibleNumbers: [9, 10],
        supply: { remainingSupply: 1490 },
      },
    });
    expect(mocks.buildState).toHaveBeenNthCalledWith(
      1,
      { id: "farm" },
      { playerId: "wallet", items: { Wood: 15400 } },
      { wallet: "wallet", lfrg: 321 },
      [],
    );
    expect(mocks.buildState).toHaveBeenNthCalledWith(
      2,
      { id: "farm" },
      { playerId: "wallet", items: { Wood: 0 } },
      { wallet: "wallet", lfrg: 321 },
      ["Forester's Totem"],
    );
    expect(mocks.getOwnedCollectibleNames).toHaveBeenCalledTimes(2);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("returns a stable 422 error and does not persist generic state on failure", async () => {
    mocks.forge.mockRejectedValue(new Error("Forester's Totem is sold out"));

    const response = await POST(
      request({
        type: "collectible.crafted",
        payload: { name: "Forester's Totem", quantity: 1 },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      success: false,
      error: "Forester's Totem is sold out",
      code: "COLLECTIBLE_CRAFT_FAILED",
    });
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.getInventory).toHaveBeenCalledTimes(1);
  });
});

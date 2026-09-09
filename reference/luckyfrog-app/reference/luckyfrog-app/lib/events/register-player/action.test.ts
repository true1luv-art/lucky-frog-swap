import { describe, it, expect, vi, beforeEach } from "vitest";
import { execute } from "./action";

// Mock repositories, database, and JWT so tests run without external services.
vi.mock("@/lib/config/database", () => ({
  connectDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/modules/players/repository.server", () => ({
  findPlayerByWallet: vi.fn(),
  createPlayer: vi.fn(),
}));

vi.mock("@/lib/auth/jwt", () => ({
  signToken: vi.fn().mockResolvedValue("mock-jwt-token"),
}));

vi.mock("@/lib/solana/balance.server", () => ({
  checkLfrgEligibility: vi.fn().mockResolvedValue({
    eligible: true,
    balance: 1_000,
    minHold: 100,
  }),
}));

import {
  findPlayerByWallet,
  createPlayer,
} from "@/lib/modules/players/repository.server";

const mockPlayer = {
  wallet: "AbcDeFgHiJkLmNoPqRsTuVwXyZ123456789",
  lfrg: 0,
  charm: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("register-player", () => {
  it("creates a new player with default game state", async () => {
    vi.mocked(findPlayerByWallet).mockResolvedValue(null);
    vi.mocked(createPlayer).mockResolvedValue(mockPlayer as never);

    const result = await execute({ wallet: mockPlayer.wallet });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.token).toBe("mock-jwt-token");
      expect(result.player).toEqual(mockPlayer);
    }
    expect(createPlayer).toHaveBeenCalledWith({
      wallet: mockPlayer.wallet,
      referrer: undefined,
    });
  });

  it("returns already-registered if wallet already exists", async () => {
    vi.mocked(findPlayerByWallet).mockResolvedValue(mockPlayer as never);

    const result = await execute({ wallet: mockPlayer.wallet });

    expect(result.status).toBe("already-registered");
    expect(createPlayer).not.toHaveBeenCalled();
  });

  it("rejects an invalid (too short) wallet address", async () => {
    const result = await execute({ wallet: "short" });
    expect(result.status).toBe("invalid-wallet");
  });

  it("rejects an empty wallet address", async () => {
    const result = await execute({ wallet: "" });
    expect(result.status).toBe("invalid-wallet");
  });
});

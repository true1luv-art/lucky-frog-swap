import { describe, it, expect, vi, beforeEach } from "vitest";
import { execute } from "./action";

vi.mock("@/lib/config/database", () => ({
  connectDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/modules/players/repository.server", () => ({
  findPlayerByWallet: vi.fn(),
}));

vi.mock("@/lib/auth/jwt", () => ({
  signToken: vi.fn().mockResolvedValue("mock-jwt-token"),
}));

// Signature verification — default to valid
vi.mock("@/lib/auth/verify-signature.server", () => ({
  verifyWalletSignature: vi.fn().mockResolvedValue(true),
}));

import { findPlayerByWallet } from "@/lib/modules/players/repository.server";

const MOCK_WALLET = "4rR3sTaFwM2noFGRcQL8j3N1vW8XB7mykUGqDj3i7abc";
const MOCK_PLAYER = { wallet: MOCK_WALLET.toLowerCase(), coins: 0 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("login-player", () => {
  it("returns ok with token when player is found", async () => {
    vi.mocked(findPlayerByWallet).mockResolvedValue(MOCK_PLAYER as never);

    const result = await execute({ wallet: MOCK_WALLET });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.token).toBe("mock-jwt-token");
      expect(result.player).toEqual(MOCK_PLAYER);
    }
  });

  it("returns not-registered when player does not exist", async () => {
    vi.mocked(findPlayerByWallet).mockResolvedValue(null);

    const result = await execute({ wallet: MOCK_WALLET });

    expect(result.status).toBe("not-registered");
  });

  it("returns invalid-wallet for a too-short address", async () => {
    const result = await execute({ wallet: "ab" });
    expect(result.status).toBe("invalid-wallet");
  });

  it("returns invalid-wallet for an empty wallet", async () => {
    const result = await execute({ wallet: "" });
    expect(result.status).toBe("invalid-wallet");
  });

  it("returns invalid-signature when signature verification fails", async () => {
    const { verifyWalletSignature } = await import("@/lib/auth/verify-signature.server");
    vi.mocked(verifyWalletSignature).mockResolvedValueOnce(false);

    const result = await execute({
      wallet:    MOCK_WALLET,
      signature: "bad-signature",
      message:   "Sign in to HFARM",
    });

    expect(result.status).toBe("invalid-signature");
  });

  it("normalises wallet to lowercase before lookup", async () => {
    vi.mocked(findPlayerByWallet).mockResolvedValue(MOCK_PLAYER as never);

    await execute({ wallet: MOCK_WALLET });

    expect(findPlayerByWallet).toHaveBeenCalledWith(MOCK_WALLET.toLowerCase());
  });
});

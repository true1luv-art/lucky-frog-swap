import { createPlayer, findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { PlayerModel } from "@/lib/modules/players/model.server";
import { connectDatabase } from "@/lib/config/database";
import { signToken } from "@/lib/auth/jwt";
import { config } from "@/lib/config/config";
import { verifyWalletSignature } from "@/lib/auth/verify-signature.server";

export interface RegisterPlayerInput {
  wallet: string;
  walletType?: string;
  username?: string;
  signature?: string;
  message?: string;
  referrer?: string;
}

export type RegisterPlayerResult =
  | { status: "ok"; player: object; token: string }
  | { status: "already-registered"; player: object; token: string }
  | { status: "invalid-wallet" }
  | { status: "invalid-signature" }
  | { status: "username-required" }
  | { status: "username-taken" }
  | { status: "username-invalid" };

/**
 * Event: RegisterPlayer
 * Registers a new wallet on any supported chain, or returns the existing player + JWT.
 * Chain is determined by config.blockchain.chain (NEXT_PUBLIC_CHAIN env var).
 */
export async function execute(
  input: RegisterPlayerInput,
): Promise<RegisterPlayerResult> {
  const { wallet, walletType, username, signature, message, referrer } = input;

  await connectDatabase();

  const chain = config.blockchain.chain;

  // 1. Basic wallet validation — relaxed for non-EVM chains (Hive usernames can be 3 chars)
  if (!wallet || wallet.trim().length < 3) {
    return { status: "invalid-wallet" };
  }

  // 2. Signature verification via chain-dispatching verifier
  if (signature && message) {
    const valid = await verifyWalletSignature({ chain, wallet, signature, message });
    if (!valid) return { status: "invalid-signature" };
  }

  const normalizedWallet = wallet.toLowerCase();

  // 3. Check if wallet already registered
  const existing = await findPlayerByWallet(normalizedWallet);
  if (existing) {
    const token = await signToken({ wallet: normalizedWallet });
    return { status: "already-registered", player: existing, token };
  }

  // 4. Validate username if provided — 3-24 chars, alphanumeric + underscores only
  const trimmed = username?.trim() ?? "";
  if (trimmed) {
    if (trimmed.length < 3) {
      return { status: "username-required" };
    }
    if (trimmed.length > 24) {
      return { status: "username-invalid" };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return { status: "username-invalid" };
    }

    // 5. Check username uniqueness (case-insensitive)
    const taken = await PlayerModel.findOne({
      username: { $regex: new RegExp(`^${trimmed}$`, "i") },
    }).lean();
    if (taken) {
      return { status: "username-taken" };
    }
  }

  // 6. Create new player document with default state
  const player = await createPlayer({ wallet: normalizedWallet, username: trimmed || undefined, referrer });
  const token = await signToken({ wallet: normalizedWallet });

  return { status: "ok", player, token };
}

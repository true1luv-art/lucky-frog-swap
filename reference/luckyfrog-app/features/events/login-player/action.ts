import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { signToken } from "@/lib/auth/jwt";
import { connectDatabase } from "@/lib/config/database";
import { config } from "@/lib/config/config";
import { verifyWalletSignature } from "@/lib/auth/verify-signature.server";

export interface LoginPlayerInput {
  wallet: string;
  walletType?: string;
  signature?: string;
  message?: string;
}

export type LoginPlayerResult =
  | { status: "ok"; player: object; token: string }
  | { status: "not-registered" }
  | { status: "invalid-wallet" }
  | { status: "invalid-signature" };

/**
 * Event: LoginPlayer
 * Authenticates a wallet on any supported chain and returns a JWT.
 * Chain is determined by config.blockchain.chain (NEXT_PUBLIC_CHAIN env var).
 */
export async function execute(
  input: LoginPlayerInput,
): Promise<LoginPlayerResult> {
  const { wallet, signature, message } = input;

  await connectDatabase();

  const chain = config.blockchain.chain;

  // Wallet identifier length check — relaxed for non-EVM chains:
  // Solana base58 pubkeys are 32-44 chars; Hive usernames 3-16 chars; EVM 42 chars.
  if (!wallet || wallet.trim().length < 3) {
    return { status: "invalid-wallet" };
  }

  if (signature && message) {
    const valid = await verifyWalletSignature({ chain, wallet, signature, message });
    if (!valid) return { status: "invalid-signature" };
  }

  const normalizedWallet = wallet.toLowerCase();
  const player = await findPlayerByWallet(normalizedWallet);
  if (!player) {
    return { status: "not-registered" };
  }

  const token = await signToken({ wallet: normalizedWallet });
  return { status: "ok", player, token };
}

import nacl from "tweetnacl";
import bs58 from "bs58";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { signToken } from "@/lib/auth/jwt";
import { checkLfrgEligibility } from "@/lib/solana/balance.server";
import { connectDatabase } from "@/lib/config/database";

export interface LoginPlayerInput {
  wallet: string;
  walletType?: "phantom" | "magiceden" | "unknown";
  signature?: string;
  message?: string;
}

export type LoginPlayerResult =
  | { status: "ok"; player: object; token: string }
  | { status: "not-registered" }
  | { status: "invalid-wallet" }
  | { status: "invalid-signature" }
  | { status: "insufficient-balance"; balance: number; minHold: number }
  | { status: "balance-check-failed" };

function verifyWalletSignature(
  wallet: string,
  signature: string,
  message: string,
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(wallet);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Event: LoginPlayer
 * Authenticates an existing wallet and returns a JWT.
 */
export async function execute(
  input: LoginPlayerInput,
): Promise<LoginPlayerResult> {
  const { wallet, signature, message } = input;

  // Ensure the DB connection is ready before any query fires.
  await connectDatabase();

  if (!wallet || wallet.trim().length < 32) {
    return { status: "invalid-wallet" };
  }

  if (signature && message) {
    const valid = verifyWalletSignature(wallet, signature, message);
    if (!valid) return { status: "invalid-signature" };
  }

  // Token-hold gate — server cross-references the signed wallet against the
  // full holders list fetched from Helius DAS (same source as the landing page).
  // The holders cache is checked first (instant Map lookup); DAS single-wallet
  // is the fallback if the cache is cold or times out.
  const { eligible, balance, minHold } = await checkLfrgEligibility(wallet);
  if (balance === null) return { status: "balance-check-failed" };
  if (!eligible) return { status: "insufficient-balance", balance, minHold };

  const player = await findPlayerByWallet(wallet);
  if (!player) {
    return { status: "not-registered" };
  }

  const token = await signToken({ wallet });
  return { status: "ok", player, token };
}

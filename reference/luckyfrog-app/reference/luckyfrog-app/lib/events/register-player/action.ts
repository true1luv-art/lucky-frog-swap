import nacl from "tweetnacl";
import bs58 from "bs58";
import { createPlayer, findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { PlayerModel } from "@/lib/modules/players/model.server";
import { connectDatabase } from "@/lib/config/database";
import { signToken } from "@/lib/auth/jwt";
import { checkLfrgEligibility } from "@/lib/solana/balance.server";

export interface RegisterPlayerInput {
  wallet: string;
  walletType?: "phantom" | "magiceden" | "unknown";
  username?: string; // optional — can be set later via profile update
  signature?: string; // base58-encoded signature (optional during dev)
  message?: string; // signed message text
  referrer?: string;
}

export type RegisterPlayerResult =
  | { status: "ok"; player: object; token: string }
  | { status: "already-registered"; player: object; token: string }
  | { status: "invalid-wallet" }
  | { status: "invalid-signature" }
  | { status: "insufficient-balance"; balance: number; minHold: number }
  | { status: "balance-check-failed" }
  | { status: "username-required" }
  | { status: "username-taken" }
  | { status: "username-invalid" };

/**
 * Validates a Solana wallet signature.
 * Returns true if the signature matches the message and wallet.
 */
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
 * Event: RegisterPlayer
 * Registers a new wallet or returns the existing player + JWT.
 */
export async function execute(
  input: RegisterPlayerInput,
): Promise<RegisterPlayerResult> {
  const { wallet, walletType, username, signature, message, referrer } = input;

  // 0. Ensure the DB connection is ready before any query fires.
  //    With bufferCommands: false, queries fail immediately on a cold start
  //    if connectDatabase() hasn't been awaited yet.
  await connectDatabase();

  // 1. Basic wallet validation
  if (!wallet || wallet.trim().length < 32) {
    return { status: "invalid-wallet" };
  }

  // 2. Signature verification (skip in dev if signature not provided)
  if (signature && message) {
    const valid = verifyWalletSignature(wallet, signature, message);
    if (!valid) return { status: "invalid-signature" };
  }

  // 2b. Token-hold gate — enforced server-side so registration cannot bypass
  // the requirement. Threshold comes from MIN_HOLD_LFRG.
  const eligibility = await checkLfrgEligibility(wallet);
  if (eligibility.balance === null) {
    return { status: "balance-check-failed" };
  }
  if (!eligibility.eligible) {
    return {
      status: "insufficient-balance",
      balance: eligibility.balance,
      minHold: eligibility.minHold,
    };
  }

  // 3. Check if wallet already registered
  const existing = await findPlayerByWallet(wallet);
  if (existing) {
    const token = await signToken({ wallet });
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
  const player = await createPlayer({ wallet, username: trimmed || undefined, referrer });
  const token = await signToken({ wallet });

  return { status: "ok", player, token };
}

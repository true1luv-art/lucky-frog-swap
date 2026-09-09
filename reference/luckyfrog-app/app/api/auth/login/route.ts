import { cookies }           from "next/headers";
import { apiOk, apiError }   from "@/lib/api/error-response";
import { signToken }         from "@/lib/auth/jwt";
import { connectDatabase }   from "@/lib/config/database";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import {
  verifyWalletSignature,
  getActiveChain,
} from "@/lib/auth/verify-signature.server";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_JSON", 400);
  }

  const { wallet, signature, message } = (body ?? {}) as Record<string, unknown>;

  if (!wallet || typeof wallet !== "string" || !wallet.trim()) {
    return apiError("wallet is required", "INVALID_WALLET", 400);
  }

  const chain         = getActiveChain(); // always "robinhood"
  const trimmedWallet = wallet.trim();

  // Verify cryptographic ownership. Robinhood: personal_sign + ethers.verifyMessage.
  // Signature-less path is only allowed in development for quick local testing.
  if (signature && message) {
    const valid = await verifyWalletSignature({
      chain,
      wallet:    trimmedWallet,
      message:   String(message),
      signature: String(signature),
    });
    if (!valid) {
      return apiError("Signature verification failed.", "INVALID_SIGNATURE", 401);
    }
  } else if (process.env.NODE_ENV === "production") {
    return apiError("Signature required in production.", "SIGNATURE_REQUIRED", 400);
  }

  await connectDatabase();
  const player = await findPlayerByWallet(trimmedWallet);

  if (!player) {
    return apiError(
      "No account found for this wallet.",
      "NOT_REGISTERED",
      404,
    );
  }

  const token = await signToken({ wallet: trimmedWallet });

  const cookieStore = await cookies();
  cookieStore.set("rhf_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 7,
  });

  return apiOk({
    status: "ok",
    chain,
    player: {
      wallet:   trimmedWallet,
      username: (player as { username?: string })?.username ?? null,
      coins:    (player as { coins?: number })?.coins ?? 0,
    },
    token,
  });
}

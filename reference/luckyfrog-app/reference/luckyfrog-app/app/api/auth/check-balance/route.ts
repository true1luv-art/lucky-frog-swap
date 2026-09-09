import { config } from "@/lib/config/config";
import { checkLfrgEligibility } from "@/lib/solana/balance.server";

/**
 * GET /api/auth/check-balance?wallet=<address>
 * Checks whether a wallet holds at least the configured minimum $LFRG.
 * The threshold comes from MIN_HOLD_LFRG (staging = 1000000, prod = 1000).
 *
 * Called with no `wallet` it just returns the current minHold so the UI
 * can display the requirement without needing a separate env var.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return Response.json({ minHold: config.minHoldLfrg });
  }

  if (wallet.length < 32) {
    return Response.json(
      { eligible: false, balance: 0, minHold: config.minHoldLfrg, error: "Invalid wallet" },
      { status: 400 },
    );
  }

  try {
    const { eligible, balance, minHold } = await checkLfrgEligibility(wallet);

    if (balance === null) {
      // Return a distinct status so the UI can show a retry prompt instead of
      // silently treating the user as ineligible.
      return Response.json(
        { eligible: false, balance: 0, minHold, rpcError: true, error: "RPC unavailable" },
        { status: 503 },
      );
    }

    return Response.json({ eligible, balance, minHold });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { eligible: false, balance: 0, minHold: config.minHoldLfrg, error: message },
      { status: 500 },
    );
  }
}

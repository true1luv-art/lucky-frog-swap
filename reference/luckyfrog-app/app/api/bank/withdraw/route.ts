import { apiOk, apiError } from "@/lib/api/error-response";
import { getWallet }        from "@/lib/api/get-wallet";
import { enqueueWithdrawal } from "@/lib/modules/transactions-pending/repository.server";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { PlayerModel }        from "@/lib/modules/players/model.server";
import { connectDatabase }    from "@/lib/config/database";

/**
 * POST /api/bank/withdraw
 *
 * Body: { amount: number }
 *
 * Enqueue-only: validates the request cheaply, then drops a row on the
 * durable `transactions_pending` queue. The Robinhood Chain settlement
 * worker drains the queue, sends $LFRG tokens on-chain, debits coins, and
 * records the processed transaction. The client then polls
 * GET /api/transactions to watch the settled row appear.
 *
 * Withdrawals are gated behind NEXT_PUBLIC_WALLET_ENABLED=true.
 */
export async function POST(req: Request): Promise<Response> {
  // Server-side gate
  if (process.env.NEXT_PUBLIC_WALLET_ENABLED !== "true") {
    return apiError(
      "Withdrawals are currently disabled",
      "WITHDRAWALS_DISABLED",
      503,
    );
  }

  const wallet = await getWallet(req);
  if (!wallet) return apiError("Not authenticated", "UNAUTHORIZED", 401);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError("Invalid JSON body", "INVALID_JSON", 400); }

  const { amount } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount < 1
  ) {
    return apiError("Amount must be a positive integer", "INVALID_AMOUNT", 400);
  }

  await connectDatabase();

  const player = await findPlayerByWallet(wallet);
  if (!player) return apiError("Player not found", "NOT_FOUND", 404);

  const coins = (player as { coins?: number }).coins ?? 0;
  if (coins < amount) {
    return apiError("Insufficient coin balance", "INSUFFICIENT_COINS", 422);
  }

  // Enqueue first, then atomically debit.  Using $inc with a negative value on
  // a filtered findOneAndUpdate gives us a safe read-modify-write with no race:
  // if the player's coins somehow dropped between the check above and now, the
  // $gt guard makes the update a no-op and we return an error before confirming.
  const updated = await PlayerModel.findOneAndUpdate(
    { wallet, coins: { $gte: amount } },
    { $inc: { coins: -amount } },
    { new: true },
  ).lean();

  if (!updated) {
    return apiError("Insufficient coin balance", "INSUFFICIENT_COINS", 422);
  }

  const tx = await enqueueWithdrawal({
    walletAddress:  wallet,
    withdrawAmount: amount,
  });

  return apiOk({ status: "queued", signature: tx.signature }, 202);
}

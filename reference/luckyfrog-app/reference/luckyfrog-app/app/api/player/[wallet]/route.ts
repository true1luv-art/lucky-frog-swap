import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { getLfrgBalance } from "@/lib/solana/balance.server";
import { apiError } from "@/lib/api/error-response";
import { connectDatabase } from "@/lib/config/database";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;

  // Ensure the DB connection is ready before any query fires.
  await connectDatabase();

  // Fetch player doc and on-chain balance in parallel. §1.4-A
  const [player, walletBalance] = await Promise.all([
    findPlayerByWallet(wallet),
    getLfrgBalance(wallet),
  ]);

  if (!player) {
    return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
  }

  return Response.json({
    ...player,
    // Expose both balances so the client can display them separately:
    //   gameBalance   — persisted in-game LFRG
    //   walletBalance — confirmed on-chain $LFRG SPL balance
    gameBalance: player.lfrg ?? 0,
    walletBalance: walletBalance ?? 0,
  });
}

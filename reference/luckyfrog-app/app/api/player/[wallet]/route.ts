import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { apiError } from "@/lib/api/error-response";
import { connectDatabase } from "@/lib/config/database";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;

  // Ensure the DB connection is ready before any query fires.
  await connectDatabase();

  const player = await findPlayerByWallet(wallet);

  if (!player) {
    return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
  }

  return Response.json(player);
}

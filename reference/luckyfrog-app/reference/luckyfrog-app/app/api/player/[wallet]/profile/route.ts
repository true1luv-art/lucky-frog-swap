/**
 * GET /api/player/[wallet]/profile
 *
 * Returns a public profile for a given wallet address:
 *   - Player combat and drop stats
 *   - Persisted game balance
 *   - Join date (registrationTime)
 *
 * Security: JWT fields (token, _id), internal DB timestamps, and __v are
 * never included in the response. §1.6-B
 *
 * Auth: none — profiles are public.
 */

import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { apiError } from "@/lib/api/error-response";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;

  const player = await findPlayerByWallet(wallet);

  if (!player) {
    return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
  }

  // §1.6-B — safe public fields only. Never expose: JWT, password, _id internals, __v.
  return Response.json({
    wallet: player.wallet,
    username: player.username ?? null,
    registrationTime: player.registrationTime,
    stats: {
      luck: player.stats?.luck ?? 0,
      dodge: player.stats?.dodge ?? 0,
      crit: player.stats?.crit ?? 0,
      damage: player.stats?.damage ?? 0,
      defense: player.stats?.defense ?? 0,
    },
    gameBalance: player.lfrg ?? 0,
  });
}

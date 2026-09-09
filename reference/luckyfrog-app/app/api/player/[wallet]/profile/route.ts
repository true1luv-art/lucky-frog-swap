/**
 * GET /api/player/[wallet]/profile
 *
 * Returns a public profile for a given wallet address.
 * Auth: none — profiles are public.
 */

import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { getOrCreateFarm } from "@/lib/modules/farms/repository.server";
import { apiError } from "@/lib/api/error-response";

const INITIAL_PLAYER_STATS = { attack: 0, defense: 0, luck: 0, speed: 0, crit: 0 };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;

  const player = await findPlayerByWallet(wallet);

  if (!player) {
    return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
  }

  const farm = await getOrCreateFarm(wallet);

  return Response.json({
    wallet:           player.wallet,
    username:         player.username ?? null,
    registrationTime: player.registrationTime,
    skills:           player.skills ?? {},
    stats:            player.stats ?? INITIAL_PLAYER_STATS,
    farmLevel:        farm.level ?? 1,
  });
}

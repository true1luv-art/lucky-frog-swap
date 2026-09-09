import { PlayerModel } from "./model.server";
import type { CreatePlayerInput, UpdatePlayerStateInput } from "@/shared/types/players";
import { connectDatabase } from "@/lib/config/database";

/**
 * Create a new player document with the default game state.
 */
export async function createPlayer(input: CreatePlayerInput) {
  await connectDatabase();
  const now = Date.now();
  return PlayerModel.create({
    wallet: input.wallet,
    username: input.username,
    referrer: input.referrer,
    lfrg: 0,
    charm: 0,
    // New players start with a small stash so they immediately have something
    // to build on. Existing players are unaffected (the model default is 0). §C2
    stash: 10,
    stats: {
      luck: 0,
      dodge: 0,
      crit: 0,
      damage: 0,
      defense: 0,
    },
    registrationTime: now,
  });
}

/**
 * Find a player by their Solana wallet address.
 */
export async function findPlayerByWallet(wallet: string) {
  await connectDatabase();
  return PlayerModel.findOne({ wallet }).lean();
}

/**
 * Update mutable player state fields.
 * player.stats must NEVER be updated directly — use the recompute-player event.
 */
export async function updatePlayerState(
  wallet: string,
  updates: UpdatePlayerStateInput,
) {
  await connectDatabase();
  return PlayerModel.findOneAndUpdate(
    { wallet },
    { $set: updates },
    { new: true },
  ).lean();
}

/**
 * Fetch all players — used for the leaderboard.
 */
export async function getAllPlayers() {
  await connectDatabase();
  return PlayerModel.find({}).lean();
}

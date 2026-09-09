import { PlayerModel }               from "./model.server";
import type { CreatePlayerInput, UpdatePlayerStateInput } from "@/features/types/players";
import { connectDatabase }           from "@/lib/config/database";

export async function createPlayer(input: CreatePlayerInput) {
  await connectDatabase();
  return PlayerModel.create({
    wallet:           input.wallet,
    username:         input.username,
    referrer:         input.referrer,
    registrationTime: Date.now(),
  });
}

export async function findPlayerByWallet(wallet: string) {
  await connectDatabase();
  return PlayerModel.findOne({ wallet }).lean();
}

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

export async function getAllPlayers() {
  await connectDatabase();
  return PlayerModel.find({}).lean();
}





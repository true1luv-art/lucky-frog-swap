import mongoose, { Schema, Model } from "mongoose";
import type { IPlayer } from "./types.server";
import type { PlayerSkills, PlayerStats } from "@/shared/types/players";

export type { IPlayer } from "./types.server";

const PlayerSkillsSchema = new Schema<PlayerSkills>(
  {
    farming:     { type: Number, default: 0 },
    mining:      { type: Number, default: 0 },
    woodcutting: { type: Number, default: 0 },
    fishing:     { type: Number, default: 0 },
    cooking:     { type: Number, default: 0 },
    crafting:    { type: Number, default: 0 },
    husbandry:   { type: Number, default: 0 },
    combat:      { type: Number, default: 0 },
  },
  { _id: false },
);

const PlayerStatsSchema = new Schema<PlayerStats>(
  {
    luck: { type: Number, default: 0 },
    dodge: { type: Number, default: 0 },
    crit: { type: Number, default: 0 },
    damage: { type: Number, default: 0 },
    defense: { type: Number, default: 0 },
  },
  { _id: false },
);

const PlayerSchema = new Schema<IPlayer>(
  {
    wallet: { type: String, required: true, unique: true, index: true },
    username: { type: String },

    lfrg: { type: Number, default: 0 },
    charm: { type: Number, default: 0 },
    // §C2 — Cumulative LFRG burned to treasury. Boosts luck + dodge permanently.
    stash: { type: Number, default: 0 },

    stats: { type: PlayerStatsSchema, default: () => ({}) },

    // §C4 — xp / level fields removed ("No Player Level", §5.13).

    registrationTime: { type: Number, required: true },
    referrer: { type: String },

    // §2.1-C — Embedded skill XP. All skills default to 0 (level 1).
    skills: { type: PlayerSkillsSchema, default: () => ({}) },
  },
  { collection: "players" },
);

export const PlayerModel: Model<IPlayer> =
  mongoose.models.Player ?? mongoose.model<IPlayer>("Player", PlayerSchema);

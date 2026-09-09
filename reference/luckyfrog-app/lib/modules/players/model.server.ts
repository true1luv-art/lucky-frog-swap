import mongoose, { Schema, Model } from "mongoose";
import type { IPlayer } from "./types.server";
import type { PlayerSkills } from "@/features/types/players";
import type { PlayerStats } from "@/lib/modules/players/types.server";
import type { EmbeddedQuest } from "@/features/types/quests";

export type { IPlayer } from "./types.server";

// ---------------------------------------------------------------------------
// Quests sub-schema (moved from FarmSchema — belongs to the player, not the world)
// ---------------------------------------------------------------------------

const EmbeddedQuestSchema = new Schema<EmbeddedQuest>(
  {
    id:         { type: String, required: true },
    category:   { type: String, enum: ["farming", "mining", "woodcutting", "fishing", "husbandry", "cooking"], required: true },
    difficulty: { type: String, enum: ["easy", "normal", "hard", "expert"], required: true },
    status:     { type: String, enum: ["active", "completed", "expired"], default: "active" },
    objective: {
      resource: { type: String, required: true },
      required: { type: Number, required: true },
    },
    rewards: {
      skillXp:    { type: Number, required: true },
      seedReward: { type: String },
      goldReward: { type: Number },
    },
    generatedAt: { type: Number, required: true },
    expiresAt:   { type: Number, required: true },
    completedAt: { type: Number },
  },
  { _id: false },
);

const PlayerStatsSchema = new Schema<PlayerStats>(
  {
    attack:  { type: Number, default: 0 },
    defense: { type: Number, default: 0 },
    luck:    { type: Number, default: 0 },
    speed:   { type: Number, default: 0 },
    crit:    { type: Number, default: 0 },
  },
  { _id: false },
);

const PlayerSkillsSchema = new Schema<PlayerSkills>(
  {
    farming:     { type: Number, default: 0 },
    mining:      { type: Number, default: 0 },
    woodcutting: { type: Number, default: 0 },
    fishing:     { type: Number, default: 0 },
    husbandry:   { type: Number, default: 0 },
    cooking:     { type: Number, default: 0 },
    smithing:    { type: Number, default: 0 },
  },
  { _id: false },
);

const PlayerSchema = new Schema<IPlayer>(
  {
    wallet:           { type: String, required: true, unique: true, index: true },
    username:         { type: String },
    registrationTime: { type: Number, required: true },
    referrer:         { type: String },

    skills: { type: PlayerSkillsSchema, default: () => ({}) },

    stats: { type: PlayerStatsSchema, default: () => ({}) },

    // In-game coin balance. Earned by selling resources, crops, and food.
    coins: { type: Number, default: 0 },

    // Lifetime milestone counters (e.g. "Quests Completed", "Crops Harvested").
    // Moved from the farm document so they persist across farm resets.
    milestones: { type: Map, of: Number, default: {} },

    // Daily quests — embedded here so they survive farm resets.
    // No history requirement, so a separate collection is unnecessary.
    quests: {
      daily: { type: [EmbeddedQuestSchema], default: [] },
    },

  },
  { collection: "players" },
);

export const PlayerModel: Model<IPlayer> =
  mongoose.models.Player ?? mongoose.model<IPlayer>("Player", PlayerSchema);

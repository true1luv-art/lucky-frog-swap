/**
 * lib/modules/farms/repository.server.ts
 *
 * Data-access layer for the `farms` collection. §2.1-A / §2.1-D
 *
 * All queries are scoped to `playerId` (wallet address).
 * createInitialFarm() seeds the same initial state as the Phaser client's
 * INITIAL_FARM constant so that new players start with identical data on
 * both client and server.
 */

import { FarmModel } from "@/lib/modules/farms/model.server";
import type { IFarm } from "@/lib/modules/farms/types.server";
import type { EmbeddedQuest } from "@/shared/types/quests";
import type { PlayerSkills } from "@/shared/types/players";
import { connectDatabase } from "@/lib/config/database";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns the farm document for `playerId`, or null if none exists.
 * Does NOT create a farm if missing — call `createInitialFarm` for that. §2.1-D
 */
export async function getFarm(playerId: string): Promise<IFarm | null> {
  await connectDatabase();
  return FarmModel.findOne({ playerId }).lean<IFarm>();
}

/**
 * Returns the farm document if it exists, otherwise creates and returns
 * the initial farm seed. Use this on first farm visit. §2.1-D
 */
export async function getOrCreateFarm(playerId: string): Promise<IFarm> {
  await connectDatabase();
  const existing = await FarmModel.findOne({ playerId }).lean<IFarm>();
  if (existing) return existing;
  return createInitialFarm(playerId);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Atomically updates any subset of the farm document.
 * Caller passes a MongoDB update expression (e.g. `{ $set: { ... } }`).
 * Returns the updated document. §2.1-A
 */
export async function upsertFarm(
  playerId: string,
  updateExpr: Record<string, unknown>,
): Promise<IFarm | null> {
  await connectDatabase();
  return FarmModel.findOneAndUpdate(
    { playerId },
    updateExpr,
    { new: true, upsert: true, lean: true },
  );
}

/**
 * Applies a partial patch to the farm using `$set`.
 * Convenience wrapper around `upsertFarm` for simple field updates.
 */
export async function patchFarm(
  playerId: string,
  patch: Partial<Record<string, unknown>>,
): Promise<IFarm | null> {
  return upsertFarm(playerId, { $set: patch });
}

// ---------------------------------------------------------------------------
// 2.1-D — Initial farm seed
// ---------------------------------------------------------------------------

/**
 * Creates and persists the INITIAL_FARM document for a new player. §2.1-D
 *
 * Mirrors phaser/game/lib/constants.ts INITIAL_FARM:
 *   - 3 Potato plots pre-planted (plantedAt=0, treated as already harvestable)
 *   - 5 wood trees, 3 stone rocks, 2 iron nodes, 1 gold node
 *   - Stamina at full (100/100)
 *   - Fishing, cooking, activity, achievements all empty
 *
 * The inventory (initial seeds + crops) is seeded separately in the
 * `inventories` collection by `createInitialInventory()`. §2.1-B
 */
export async function createInitialFarm(playerId: string): Promise<IFarm> {
  await connectDatabase();
  const now = Date.now();

  const doc = new FarmModel({
    playerId,

    // 3 crop plots with Potato pre-planted (plantedAt=0 → harvestable immediately)
    fields: {
      "0": { name: "Potato", plantedAt: 0 },
      "1": { name: "Potato", plantedAt: 0 },
      "2": { name: "Potato", plantedAt: 0 },
    },

    // 5 wood trees
    trees: {
      "0": { name: "Wood", amount: 3 },
      "1": { name: "Wood", amount: 4 },
      "2": { name: "Wood", amount: 5 },
      "3": { name: "Wood", amount: 5 },
      "4": { name: "Wood", amount: 3 },
    },

    // 3 stone rocks
    stones: {
      "0": { name: "Stone", amount: 2 },
      "1": { name: "Stone", amount: 3 },
      "2": { name: "Stone", amount: 4 },
    },

    // 2 iron nodes
    iron: {
      "0": { name: "Iron", amount: 2 },
      "1": { name: "Iron", amount: 3 },
    },

    // 1 gold node
    gold: {
      "0": { name: "Gold", amount: 2 },
    },

    // No animals placed yet
    chickens: {},
    cows:     {},
    sheep:    {},

    fishing: {
      lastCastAt: 0,
      lastCaughtFish: null,
      lastCaughtAmount: 0,
      totalCasts: 0,
      totalCaught: 0,
    },

    cooking: null,

    stamina: {
      current: 100,
      max: 100,
      lastRegenAt: now,
    },

    quests: {
      daily:  [],
      weekly: [],
    },

    activity:     {},
    achievements: {},
  });

  await doc.save();
  return doc.toObject() as IFarm;
}

/**
 * Deletes the farm document for `playerId`.
 * Used in tests and the migration endpoint. §2.5-E
 */
export async function deleteFarm(playerId: string): Promise<void> {
  await connectDatabase();
  await FarmModel.deleteOne({ playerId });
}

// ---------------------------------------------------------------------------
// §fold-quests — Quest persistence primitive
// ---------------------------------------------------------------------------

/**
 * Persists a new set of daily and/or weekly quests onto the farm document.
 * Pure DB write — no staleness checks or generation logic here; that lives
 * in service.server.ts (`refreshQuestsIfStale`).
 */
export async function saveQuests(
  wallet: string,
  quests: { daily: EmbeddedQuest[]; weekly: EmbeddedQuest[] },
): Promise<void> {
  await connectDatabase();
  await FarmModel.findOneAndUpdate(
    { playerId: wallet },
    { $set: { "quests.daily": quests.daily, "quests.weekly": quests.weekly } },
    { new: false },
  );
}

/**
 * Marks a quest as completed on the farm document (atomic $set on the
 * matching embedded quest by `id`).
 *
 * Uses an array-filter update so only the target element is mutated.
 * Returns the updated farm, or null if the quest was not found / not active.
 */
export async function completeQuestOnFarm(
  wallet:      string,
  questId:     string,
  type:        "daily" | "weekly",
  rollResults: EmbeddedQuest["rollResults"],
): Promise<boolean> {
  await connectDatabase();
  const arrayField = `quests.${type}`;
  const result = await FarmModel.updateOne(
    {
      playerId: wallet,
      [`${arrayField}`]: { $elemMatch: { id: questId, status: "active" } },
    },
    {
      $set: {
        [`${arrayField}.$[elem].status`]:      "completed",
        [`${arrayField}.$[elem].completedAt`]: Date.now(),
        [`${arrayField}.$[elem].rollResults`]: rollResults ?? [],
      },
    },
    {
      arrayFilters: [{ "elem.id": questId, "elem.status": "active" }],
    },
  );

  return result.modifiedCount > 0;
}

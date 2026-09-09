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
import { PlayerModel } from "@/lib/modules/players/model.server";
import type { IFarm } from "@/lib/modules/farms/types.server";
import type { EmbeddedQuest } from "@/features/types/quests";
import type { PlayerSkills }  from "@/features/types/players";
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
 * Node counts mirror the world position arrays in phaser/positions/:
 *   - 8 wood trees  (TREE_POSITIONS)
 *   - 6 stone rocks (STONE_POSITIONS)
 *   - 3 iron nodes  (IRON_POSITIONS)
 *   - 2 gold nodes  (GOLD_POSITIONS)
 *
 * `amount` is NOT stored — it is static config (always 1 in Phase 2) injected
 * at hydration time by buildResourceNodes() in build-state.ts.
 *
 * The inventory (initial seeds + crops) is seeded separately in the
 * `inventories` collection by `createInitialInventory()`. §2.1-B
 */
export async function createInitialFarm(playerId: string): Promise<IFarm> {
  await connectDatabase();
  const now = Date.now();

  const doc = new FarmModel({
    playerId,

    // All plots start empty — player plants their first crop themselves.
    fields: {},

    // No animals placed yet
    chickens: {},
    cows:     {},
    sheep:    {},

    // Flat stamina fields matching FarmSchema (Number, not a nested object).
    stamina:        100,
    staminaRegenAt: now,
  });

  await doc.save();
  return doc.toObject() as IFarm;
}

/**
 * Lazily expires stale quests and generates fresh ones when needed.
 * Quests are now stored on the player document, not the farm.
 *
 * Called at the top of GET /api/farm and GET /api/quests so every farm read
 * returns an up-to-date quest board with no background job.
 *
 * @param wallet       - Player wallet address.
 * @param generators   - Injected quest-engine functions (avoids circular imports).
 * @param playerSkills - Player skills used by the generators.
 * @returns            - Up-to-date embedded quests (freshly persisted if changed).
 */
export async function refreshQuestsIfStale(
  wallet: string,
  generators: {
    generateDailyQuests: (skills: PlayerSkills) => Promise<EmbeddedQuest[]>;
  },
  playerSkills: PlayerSkills,
): Promise<{ daily: EmbeddedQuest[] }> {
  await connectDatabase();
  const now = Date.now();
  let changed = false;

  // Fetch current quests from player document
  const player = await PlayerModel.findOne({ wallet }).lean<{ quests?: { daily: EmbeddedQuest[] } }>();
  
  let daily: EmbeddedQuest[] = (player?.quests?.daily ?? []) as EmbeddedQuest[];

  const dailyExpired = daily.length === 0 || daily.some((q) => now > q.expiresAt);
  if (dailyExpired) {
    daily = await generators.generateDailyQuests(playerSkills);
    changed = true;
  }

  if (changed) {
    await saveQuests(wallet, { daily });
  }

  return { daily };
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
 * Persists a new set of daily quests onto the player document.
 * Pure DB write — no staleness checks or generation logic here; that lives
 * in `refreshQuestsIfStale` above.
 */
export async function saveQuests(
  wallet: string,
  quests: { daily: EmbeddedQuest[] },
): Promise<void> {
  await connectDatabase();
  await PlayerModel.findOneAndUpdate(
    { wallet },
    { $set: { "quests.daily": quests.daily } },
    { new: false },
  );
}



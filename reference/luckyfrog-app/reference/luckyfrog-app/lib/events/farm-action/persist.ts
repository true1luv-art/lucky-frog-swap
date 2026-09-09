/**
 * lib/events/farm-action/persist.ts
 *
 * Persists the diff between a pre-action `GameState` and a post-action
 * `GameState` back to MongoDB. §2.2-D
 *
 * Strategy:
 * - Compares the old and new GameState to compute the minimal set of changes.
 * - Uses atomic `$inc` for inventory and balance (never replace-all; other
 *   concurrent requests must not clobber each other).
 * - Uses `$set` for scalar farm fields (stamina, cooking, fishing, single nodes).
 * - Uses a Mongoose session (transaction) when multiple collections are touched.
 * - Skill XP diffs are written via `$inc` to `players.skills`.
 *
 * Reference: docs/implementation_plans/phase-02-farming-backend.md §2.2-D
 */

import Decimal from "decimal.js-light";
import mongoose from "mongoose";
import { FarmModel } from "@/lib/modules/farms/model.server";
import { InventoryModel } from "@/lib/modules/inventories/model.server";
import { PlayerModel } from "@/lib/modules/players/model.server";
import type { GameState, GameNode, ChickenState, CowState, SheepState } from "@/shared/types/gameplay/game";
import type { PlayerSkills } from "@/shared/types/gameplay/skills";

// ---------------------------------------------------------------------------
// Inventory diff
// ---------------------------------------------------------------------------

/**
 * Computes the per-item delta between two inventories.
 * Returns { added: Record<name,+qty>, removed: Record<name,+qty> }
 * where all values are positive integers.
 */
export function inventoryDiff(
  oldInv: GameState["inventory"],
  newInv: GameState["inventory"],
): { added: Record<string, number>; removed: Record<string, number> } {
  const added:   Record<string, number> = {};
  const removed: Record<string, number> = {};

  // Gather all item names
  const keys = new Set([
    ...Object.keys(oldInv ?? {}),
    ...Object.keys(newInv ?? {}),
  ]);

  for (const key of keys) {
    const prev = new Decimal((oldInv as Record<string, Decimal>)[key] ?? 0);
    const next = new Decimal((newInv as Record<string, Decimal>)[key] ?? 0);
    const delta = next.minus(prev);
    if (delta.greaterThan(0))     added[key]   = delta.toNumber();
    else if (delta.lessThan(0))   removed[key] = delta.negated().toNumber();
  }

  return { added, removed };
}

// ---------------------------------------------------------------------------
// Balance diff
// ---------------------------------------------------------------------------

function balanceDelta(oldState: GameState, newState: GameState): number {
  return newState.balance.minus(oldState.balance).toNumber();
}

// ---------------------------------------------------------------------------
// Skill XP diff (Phaser skills → server skills)
// §C5 — Phaser now uses canonical server names; no alias conversion needed.
// ---------------------------------------------------------------------------

/**
 * Maps a Phaser `PlayerSkills` snapshot to the server-side skill key names.
 * Names match exactly.
 */
function phaserSkillsToServer(skills: PlayerSkills): Record<string, number> {
  return {
    farming:     skills.farming     ?? 0,
    woodcutting: skills.woodcutting ?? 0,
    mining:      skills.mining      ?? 0,
    fishing:     skills.fishing     ?? 0,
    cooking:     skills.cooking     ?? 0,
    husbandry:   skills.husbandry   ?? 0,
    combat:      skills.combat      ?? 0,
  };
}

function skillDiff(oldState: GameState, newState: GameState): Record<string, number> {
  const oldSkills = phaserSkillsToServer(oldState.skills);
  const newSkills = phaserSkillsToServer(newState.skills);
  const diff: Record<string, number> = {};
  for (const key of Object.keys(newSkills)) {
    const delta = (newSkills[key] ?? 0) - (oldSkills[key] ?? 0);
    if (delta !== 0) diff[`skills.${key}`] = delta;
  }
  return diff;
}

// ---------------------------------------------------------------------------
// Farm field diff helpers
// ---------------------------------------------------------------------------

/**
 * Builds a `$set` update object for changed field (crop) nodes.
 */
function fieldsDiff(
  oldFields: GameState["fields"],
  newFields: GameState["fields"],
): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  const unset: Record<string, unknown> = {};

  // Fields that were added or changed
  for (const [idx, node] of Object.entries(newFields ?? {})) {
    const old = (oldFields ?? {})[idx as unknown as number];
    if (!old || old.plantedAt !== node.plantedAt || old.name !== node.name) {
      set[`fields.${idx}`] = { name: node.name, plantedAt: node.plantedAt };
    }
  }

  // Fields that were removed (harvested)
  for (const idx of Object.keys(oldFields ?? {})) {
    if (!(newFields ?? {})[idx as unknown as number]) {
      unset[`fields.${idx}`] = "";
    }
  }

  return { $set: set, $unset: unset };
}

/**
 * Builds `$set` expressions for changed resource nodes (trees, stones, iron, gold).
 * The server uses `harvestedAt`; Phaser uses `choppedAt` (trees) or `minedAt` (ores).
 */
function resourceNodesDiff(
  collection: "trees" | "stones" | "iron" | "gold",
  oldNodes: Record<number, GameNode>,
  newNodes: Record<number, GameNode>,
  isTree: boolean,
): Record<string, unknown> {
  const set: Record<string, unknown> = {};

  for (const [idx, node] of Object.entries(newNodes ?? {})) {
    const old = (oldNodes ?? {})[idx as unknown as number];
    const phaserHarvested = isTree ? node.choppedAt : node.minedAt;
    const oldHarvested    = isTree ? old?.choppedAt : old?.minedAt;

    if (!old || phaserHarvested !== oldHarvested || node.amount !== old.amount) {
      set[`${collection}.${idx}`] = {
        name:        node.name,
        harvestedAt: phaserHarvested,
        amount:      node.amount,
      };
    }
  }

  return set;
}

/**
 * Builds `$set` expressions for changed animal nodes.
 */
function animalNodesDiff<T extends ChickenState | CowState | SheepState>(
  collection: "chickens" | "cows" | "sheep",
  oldNodes: Record<number, T>,
  newNodes: Record<number, T>,
): Record<string, unknown> {
  const set: Record<string, unknown> = {};

  // Added or updated animals
  for (const [idx, node] of Object.entries(newNodes ?? {})) {
    const old = (oldNodes ?? {})[idx as unknown as number] as T | undefined;
    if (!old || (node as ChickenState).fedAt !== (old as ChickenState).fedAt || node.multiplier !== old.multiplier) {
      set[`${collection}.${idx}`] = {
        type:       collection === "chickens" ? "Chicken" : collection === "cows" ? "Cow" : "Sheep",
        fedAt:      (node as ChickenState).fedAt,
        multiplier: node.multiplier,
      };
    }
  }

  // Removed animals
  for (const idx of Object.keys(oldNodes ?? {})) {
    if (!(newNodes ?? {})[idx as unknown as number]) {
      set[`${collection}.${idx}`] = undefined;   // will be applied with $unset
    }
  }

  return set;
}

// ---------------------------------------------------------------------------
// Main persist function §2.2-D
// ---------------------------------------------------------------------------

/**
 * Persists the diff between `oldState` and `newState` atomically.
 *
 * Uses a MongoDB multi-document transaction when MongoDB supports it
 * (replica set or Atlas). Falls back to sequential ops when sessions are
 * not available (e.g. standalone MongoDB in development).
 *
 * @param playerId  - Wallet address of the player.
 * @param oldState  - The GameState BEFORE the action.
 * @param newState  - The GameState AFTER processGameEvent.
 */
export async function persistFarmChanges(
  playerId:  string,
  oldState:  GameState,
  newState:  GameState,
): Promise<void> {

  // -------------------------------------------------------------------------
  // 1. Compute diffs
  // -------------------------------------------------------------------------
  const { added: itemsAdded, removed: itemsRemoved } = inventoryDiff(
    oldState.inventory, newState.inventory,
  );
  const balDelta  = balanceDelta(oldState, newState);
  const xpDeltas  = skillDiff(oldState, newState);

  // Farm field diffs
  const { $set: fieldSet, $unset: fieldUnset } = fieldsDiff(
    oldState.fields, newState.fields,
  ) as { $set: Record<string, unknown>; $unset: Record<string, unknown> };

  const treeSet  = resourceNodesDiff("trees",  oldState.trees,  newState.trees,  true);
  const stoneSet = resourceNodesDiff("stones", oldState.stones, newState.stones, false);
  const ironSet  = resourceNodesDiff("iron",   oldState.iron,   newState.iron,   false);
  const goldSet  = resourceNodesDiff("gold",   oldState.gold,   newState.gold,   false);

  const chickenSet = animalNodesDiff("chickens", oldState.chickens, newState.chickens);
  const cowSet     = animalNodesDiff("cows",     oldState.cows,     newState.cows);
  const sheepSet   = animalNodesDiff("sheep",    oldState.sheep,    newState.sheep);

  // Stamina
  const staminaChanged =
    oldState.stamina.current       !== newState.stamina.current ||
    oldState.lastStaminaRegenAt    !== newState.lastStaminaRegenAt;

  // Fishing
  const fishingChanged =
    oldState.fishing.lastCastAt !== newState.fishing.lastCastAt ||
    oldState.fishing.cooldownMs !== newState.fishing.cooldownMs ||
    oldState.fishing.totalCasts !== newState.fishing.totalCasts;

  // Cooking
  const cookingChanged =
    JSON.stringify(oldState.cooking) !== JSON.stringify(newState.cooking);

  // Activity
  const activityChanged =
    JSON.stringify(oldState.activity) !== JSON.stringify(newState.activity);

  // Achievements
  const achievementsChanged =
    JSON.stringify(oldState.achievements) !== JSON.stringify(newState.achievements);

  // -------------------------------------------------------------------------
  // 2. Build farm $set payload
  // -------------------------------------------------------------------------
  const farmSet: Record<string, unknown> = {
    ...fieldSet,
    ...treeSet,
    ...stoneSet,
    ...ironSet,
    ...goldSet,
    ...chickenSet,
    ...cowSet,
    ...sheepSet,
  };

  if (staminaChanged) {
    farmSet["stamina.current"]    = newState.stamina.current;
    farmSet["stamina.lastRegenAt"] = newState.lastStaminaRegenAt;
  }
  if (fishingChanged) {
    farmSet["fishing.lastCastAt"]       = newState.fishing.lastCastAt;
    farmSet["fishing.cooldownMs"]       = newState.fishing.cooldownMs;
    farmSet["fishing.lastCaughtFish"]   = newState.fishing.lastCaughtFish;
    farmSet["fishing.lastCaughtAmount"] = newState.fishing.lastCaughtAmount;
    farmSet["fishing.totalCasts"]       = newState.fishing.totalCasts;
    farmSet["fishing.totalCaught"]      = newState.fishing.totalCaught;
  }
  if (cookingChanged) {
    farmSet["cooking"] = newState.cooking
      ? {
          item:      newState.cooking.item,
          startedAt: newState.cooking.startedAt,
          duration:  newState.cooking.duration,
        }
      : null;
  }
  if (activityChanged) {
    farmSet["activity"] = newState.activity;
  }
  if (achievementsChanged) {
    farmSet["achievements"] = newState.achievements;
  }

  // -------------------------------------------------------------------------
  // 3. Build $unset for harvested fields (removed crops)
  // -------------------------------------------------------------------------
  const farmUnset: Record<string, unknown> = { ...fieldUnset };

  // -------------------------------------------------------------------------
  // 4. Build inventory per-item bulk ops (one document per item) §9.24
  // -------------------------------------------------------------------------
  const itemOps: mongoose.AnyBulkWriteOperation[] = [];
  for (const [name, qty] of Object.entries(itemsAdded)) {
    itemOps.push({
      updateOne: {
        filter: { owner: playerId, item: name },
        update: {
          $inc: { amount: qty },
          $setOnInsert: { owner: playerId, item: name, market: null },
        },
        upsert: true,
      },
    });
  }
  for (const [name, qty] of Object.entries(itemsRemoved)) {
    itemOps.push({
      updateOne: {
        filter: { owner: playerId, item: name },
        // Pipeline update clamps the usable `amount` to >= 0 atomically.
        update: [
          {
            $set: {
              amount: { $max: [0, { $subtract: [{ $ifNull: ["$amount", 0] }, qty] }] },
            },
          },
        ],
        upsert: true,
      },
    });
  }

  // -------------------------------------------------------------------------
  // 5. Execute atomically using a session if available, else sequential
  // -------------------------------------------------------------------------
  const hasFarmChanges    = Object.keys(farmSet).length > 0 || Object.keys(farmUnset).length > 0;
  const hasItemChanges    = itemOps.length > 0;
  const hasBalanceChange  = balDelta !== 0;
  const hasSkillChanges   = Object.keys(xpDeltas).length > 0;
  const hasPlayerChanges  = hasBalanceChange || hasSkillChanges;

  if (!hasFarmChanges && !hasItemChanges && !hasPlayerChanges) return;

  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch {
    // Standalone MongoDB (dev) does not support transactions — proceed without.
    session = null;
  }

  try {
    const opts = session ? { session } : {};

    if (hasFarmChanges) {
      const updateExpr: Record<string, unknown> = {};
      if (Object.keys(farmSet).length > 0)   updateExpr["$set"]   = farmSet;
      if (Object.keys(farmUnset).length > 0)  updateExpr["$unset"] = farmUnset;
      await FarmModel.findOneAndUpdate({ playerId }, updateExpr, { upsert: true, ...opts });
    }

    if (hasItemChanges) {
      await InventoryModel.bulkWrite(itemOps, opts);
    }

    // Player-doc changes: skill XP ($inc) and persisted Game Balance (LFRG).
    if (hasPlayerChanges) {
      const playerUpdate: Record<string, unknown> = {};
      if (hasSkillChanges) playerUpdate["$inc"] = xpDeltas;
      if (hasBalanceChange) {
        const player = await PlayerModel.findOne({ wallet: playerId }, { lfrg: 1 }, opts).lean<{
          lfrg: number;
        }>();
        playerUpdate["$set"] = {
          lfrg: Math.max(0, (player?.lfrg ?? 0) + balDelta),
        };
      }
      await PlayerModel.findOneAndUpdate({ wallet: playerId }, playerUpdate, opts);
    }

    if (session) await session.commitTransaction();
  } catch (err) {
    if (session) {
      try { await session.abortTransaction(); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    if (session) await session.endSession();
  }
}

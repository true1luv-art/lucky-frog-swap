/**
 * features/farm-action/persist.ts
 *
 * Persists the diff between a pre-action `GameState` and a post-action
 * `GameState` back to MongoDB. §2.2-D
 *
 * What changed from the previous revision:
 *   - `resourceNodesDiff` (trees/stones) removed — no per-node cooldown state.
 *   - `treeSet` / `stoneSet` removed from the farm $set payload.
 *   - `equipmentChanged` farm write removed — equipment is now in the
 *     `armor_pieces` and `equipped_sets` collections via `persistEquipmentDiff`.
 *   - `toolsChanged` farm write removed — tools are now in the `tools`
 *     collection via `persistToolsDiff`.
 *   - `fishingChanged` farm write removed — no cast cooldown persisted.
 *   - Quest diff added: `quests.daily` is now written to the player document
 *     via $set when it changes.
 */

import Decimal from "decimal.js-light";
import { FarmModel }      from "@/lib/modules/farms/model.server";
import { ItemModel } from "@/lib/modules/items/model.server";
import { PlayerModel }    from "@/lib/modules/players/model.server";
import { persistToolsDiff }      from "@/lib/modules/tools/repository.server";
import type { GameState, GameNode, ChickenState, CowState, SheepState } from "@/features/types/gameplay/game";
import type { PlayerSkills } from "@/features/types/gameplay/skills";

// ---------------------------------------------------------------------------
// Inventory diff
// ---------------------------------------------------------------------------

export function itemsDiff(
  oldItems: GameState["items"],
  newItems: GameState["items"],
): { added: Record<string, number>; removed: Record<string, number> } {
  const added:   Record<string, number> = {};
  const removed: Record<string, number> = {};

  const keys = new Set([
    ...Object.keys(oldItems ?? {}),
    ...Object.keys(newItems ?? {}),
  ]);

  for (const key of keys) {
    const prev  = new Decimal((oldItems as Record<string, Decimal>)[key] ?? 0);
    const next  = new Decimal((newItems as Record<string, Decimal>)[key] ?? 0);
    const delta = next.minus(prev);
    if (delta.greaterThan(0))   added[key]   = delta.toNumber();
    else if (delta.lessThan(0)) removed[key] = delta.negated().toNumber();
  }

  return { added, removed };
}

// ---------------------------------------------------------------------------
// Skill XP diff
// ---------------------------------------------------------------------------

function phaserSkillsToServer(skills: PlayerSkills): Record<string, number> {
  return {
    farming:     skills.farming     ?? 0,
    woodcutting: skills.woodcutting ?? 0,
    mining:      skills.mining      ?? 0,
    fishing:     skills.fishing     ?? 0,
    husbandry:   skills.husbandry   ?? 0,
    cooking:     skills.cooking     ?? 0,
    smithing:    skills.smithing    ?? 0,
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

function fieldsDiff(
  oldFields: GameState["fields"],
  newFields: GameState["fields"],
): Record<string, unknown> {
  const set:   Record<string, unknown> = {};
  const unset: Record<string, unknown> = {};

  for (const [idx, node] of Object.entries(newFields ?? {})) {
    const old = (oldFields ?? {})[idx as unknown as number];
    if (!old ||
        old.plantedAt !== node.plantedAt ||
        old.name      !== node.name      ||
        old.wateredAt !== node.wateredAt ||
        old.isWatered !== node.isWatered) {
      set[`fields.${idx}`] = {
        name:      node.name,
        plantedAt: node.plantedAt,
        ...(node.wateredAt !== undefined ? { wateredAt: node.wateredAt } : {}),
        ...(node.isWatered !== undefined ? { isWatered: node.isWatered } : {}),
      };
    }
  }

  for (const idx of Object.keys(oldFields ?? {})) {
    if (!(newFields ?? {})[idx as unknown as number]) {
      unset[`fields.${idx}`] = "";
    }
  }

  return { $set: set, $unset: unset };
}

function animalNodesDiff<T extends ChickenState | CowState | SheepState>(
  collection: "chickens" | "cows" | "sheep",
  oldNodes: Record<number, T>,
  newNodes: Record<number, T>,
): Record<string, unknown> {
  const set: Record<string, unknown> = {};

  for (const [idx, node] of Object.entries(newNodes ?? {})) {
    const old = (oldNodes ?? {})[idx as unknown as number] as T | undefined;
    if (!old || (node as ChickenState).fedAt !== (old as ChickenState).fedAt) {
      set[`${collection}.${idx}`] = {
        type:  collection === "chickens" ? "Chicken" : collection === "cows" ? "Cow" : "Sheep",
        fedAt: (node as ChickenState).fedAt,
      };
    }
  }

  for (const idx of Object.keys(oldNodes ?? {})) {
    if (!(newNodes ?? {})[idx as unknown as number]) {
      set[`${collection}.${idx}`] = undefined;
    }
  }

  return set;
}

// ---------------------------------------------------------------------------
// Quest diff — quests.daily now lives on the player document
// ---------------------------------------------------------------------------

function questsDiff(
  oldState: GameState,
  newState: GameState,
): Record<string, unknown> | null {
  const oldQ = JSON.stringify(oldState.quests?.daily ?? []);
  const newQ = JSON.stringify(newState.quests?.daily ?? []);
  if (oldQ === newQ) return null;
  return { "quests.daily": newState.quests?.daily ?? [] };
}

// ---------------------------------------------------------------------------
// Main persist function §2.2-D
// ---------------------------------------------------------------------------

export async function persistFarmChanges(
  playerId: string,
  oldState: GameState,
  newState: GameState,
): Promise<void> {

  // -------------------------------------------------------------------------
  // 1. Compute diffs
  // -------------------------------------------------------------------------
  const { added: itemsAdded, removed: itemsRemoved } = itemsDiff(
    oldState.items, newState.items,
  );

  const toolsChanged =
    JSON.stringify(oldState.tools ?? []) !== JSON.stringify(newState.tools ?? []);

  const xpDeltas = skillDiff(oldState, newState);

  const milestoneDelta: Record<string, number> = {};
  const oldM = (oldState.milestones ?? {}) as Record<string, number>;
  const newM = (newState.milestones ?? {}) as Record<string, number>;
  for (const key of new Set([...Object.keys(oldM), ...Object.keys(newM)])) {
    const delta = (newM[key] ?? 0) - (oldM[key] ?? 0);
    if (delta !== 0) milestoneDelta[`milestones.${key}`] = delta;
  }

  const { $set: fieldSet, $unset: fieldUnset } = fieldsDiff(
    oldState.fields, newState.fields,
  ) as { $set: Record<string, unknown>; $unset: Record<string, unknown> };

  const chickenSet = animalNodesDiff("chickens", oldState.chickens, newState.chickens);
  const cowSet     = animalNodesDiff("cows",     oldState.cows,     newState.cows);
  const sheepSet   = animalNodesDiff("sheep",    oldState.sheep,    newState.sheep);

  const playerStatsChanged =
    newState.playerStats !== undefined &&
    JSON.stringify(oldState.playerStats ?? null) !== JSON.stringify(newState.playerStats ?? null);

  const farmLevelChanged = (oldState.farmLevel ?? 1) !== (newState.farmLevel ?? 1);

  const questSetFields = questsDiff(oldState, newState);

  const staminaChanged =
    (oldState.stamina       ?? 100) !== (newState.stamina       ?? 100) ||
    (oldState.staminaRegenAt ?? 0)  !== (newState.staminaRegenAt ?? 0);



  const coinsChanged =
    (oldState.coins?.toNumber() ?? 0) !== (newState.coins?.toNumber() ?? 0);

  // -------------------------------------------------------------------------
  // 2. Build farm $set / $unset payload (fields + animals only)
  // -------------------------------------------------------------------------
  const farmSet: Record<string, unknown> = {
    ...fieldSet,
    ...chickenSet,
    ...cowSet,
    ...sheepSet,
    ...(staminaChanged ? {
      stamina:        newState.stamina        ?? 100,
      staminaRegenAt: newState.staminaRegenAt ?? 0,
    } : {}),
    ...(farmLevelChanged ? { level: newState.farmLevel ?? 1 } : {}),
  };
  const farmUnset: Record<string, unknown> = { ...fieldUnset };

  // -------------------------------------------------------------------------
  // 3. Build inventory bulk ops
  // -------------------------------------------------------------------------
  const itemOps: Parameters<typeof ItemModel.bulkWrite>[0] = [];
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
  // 4. Early-exit if nothing changed
  // -------------------------------------------------------------------------
  const hasFarmChanges      = Object.keys(farmSet).length > 0 || Object.keys(farmUnset).length > 0;
  const hasItemChanges      = itemOps.length > 0;
  const hasSkillChanges     = Object.keys(xpDeltas).length > 0;
  const hasMilestoneChanges = Object.keys(milestoneDelta).length > 0;
  const hasQuestChanges     = questSetFields !== null;
  const hasPlayerChanges    = hasSkillChanges || hasMilestoneChanges || playerStatsChanged || hasQuestChanges || coinsChanged;

  if (!hasFarmChanges && !hasItemChanges && !hasPlayerChanges && !toolsChanged) return;

  // -------------------------------------------------------------------------
  // 5. Write all diffs — standalone MongoDB (no replica set) so no sessions.
  // Each write is individually atomic at the document level.
  // -------------------------------------------------------------------------

  // Farm (fields + animals)
  if (hasFarmChanges) {
    const updateExpr: Record<string, unknown> = {};
    if (Object.keys(farmSet).length > 0)  updateExpr["$set"]   = farmSet;
    if (Object.keys(farmUnset).length > 0) updateExpr["$unset"] = farmUnset;
    await FarmModel.findOneAndUpdate({ playerId }, updateExpr, { upsert: true });
  }

  // Inventory (stackable items)
  if (hasItemChanges) {
    await ItemModel.bulkWrite(itemOps);
  }

  // Tools collection (one doc per instance)
  if (toolsChanged) {
    await persistToolsDiff(
      playerId,
      oldState.tools ?? [],
      newState.tools ?? [],
    );
  }

  // Player document (XP, milestones, stats, quests, coins)
  if (hasPlayerChanges) {
    const incFields: Record<string, number> = {
      ...(hasSkillChanges     ? xpDeltas      : {}),
      ...(hasMilestoneChanges ? milestoneDelta : {}),
    };
    const playerUpdate: Record<string, unknown> = {};
    if (Object.keys(incFields).length > 0) playerUpdate["$inc"] = incFields;

    const setFields: Record<string, unknown> = {};
    if (playerStatsChanged && newState.playerStats) {
      setFields["stats.attack"]  = newState.playerStats.attack;
      setFields["stats.defense"] = newState.playerStats.defense;
      setFields["stats.luck"]    = newState.playerStats.luck;
      setFields["stats.speed"]   = newState.playerStats.speed;
      setFields["stats.crit"]    = newState.playerStats.crit;
    }
    if (hasQuestChanges && questSetFields) {
      Object.assign(setFields, questSetFields);
    }
    if (coinsChanged) {
      setFields["coins"] = Math.max(0, newState.coins?.toNumber() ?? 0);
    }
    if (Object.keys(setFields).length > 0) {
      playerUpdate["$set"] = setFields;
    }

    await PlayerModel.findOneAndUpdate({ wallet: playerId }, playerUpdate);
  }
}

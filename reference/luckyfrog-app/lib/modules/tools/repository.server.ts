/**
 * lib/modules/tools/repository.server.ts
 *
 * Data-access layer for the `tools` collection.
 *
 * All mutations use atomic upserts keyed on { owner, toolId } to prevent
 * race conditions. Wood tools (durability = null) are never deleted on use.
 */

import { ToolInstanceModel } from "./model.server";
import type { IToolInstance } from "./types.server";
import type { ToolInstance } from "@/features/types/gameplay/tools";
import { connectDatabase } from "@/lib/config/database";
// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns all tool instances owned by `playerId`, or [] if none exist.
 */
export async function getTools(playerId: string): Promise<IToolInstance[]> {
  await connectDatabase();
  return ToolInstanceModel.find({ owner: playerId }).lean<IToolInstance[]>();
}

/**
 * Returns all tool instances for `playerId` as Phaser `ToolInstance[]`.
 * Used by build-state.ts to populate GameState.tools[].
 */
export async function getToolsForState(playerId: string): Promise<ToolInstance[]> {
  await connectDatabase();
  const docs = await ToolInstanceModel.find({ owner: playerId }).lean<IToolInstance[]>();
  return docs.map((d) => ({
    id:            d.toolId,
    name:          d.name,
    tier:          d.tier,
    durability:    d.durability,
    maxDurability: d.maxDurability,
  }));
}

// ---------------------------------------------------------------------------
// Write — bulk diff persist (called by persist.ts)
// ---------------------------------------------------------------------------

/**
 * Persists the diff between `oldTools` and `newTools` into the `tools` collection.
 *
 * - Tools present in `newTools` but not in `oldTools` → upsert (new craft).
 * - Tools present in both with changed durability → $set durability.
 * - Tools present in `oldTools` but absent from `newTools` → delete (broken).
 *
 * All ops are batched into a single bulkWrite.
 */
export async function persistToolsDiff(
  owner:    string,
  oldTools: ToolInstance[],
  newTools: ToolInstance[],
): Promise<void> {
  await connectDatabase();

  const oldById = new Map(oldTools.map((t) => [t.id, t]));
  const newById = new Map(newTools.map((t) => [t.id, t]));

  const ops: Parameters<typeof ToolInstanceModel.bulkWrite>[0] = [];

  // Upserts and durability updates
  for (const tool of newTools) {
    const old = oldById.get(tool.id);
    if (!old || old.durability !== tool.durability) {
      ops.push({
        updateOne: {
          filter: { owner, toolId: tool.id },
          update: {
            $set: {
              owner,
              toolId:        tool.id,
              name:          tool.name,
              tier:          tool.tier,
              durability:    tool.durability,
              maxDurability: tool.maxDurability,
            },
          },
          upsert: true,
        },
      });
    }
  }

  // Deletions — tool broken (durability hit 0 and was removed from state.tools[])
  for (const old of oldTools) {
    if (!newById.has(old.id)) {
      ops.push({
        deleteOne: { filter: { owner, toolId: old.id } },
      });
    }
  }

  if (ops.length === 0) return;
  await ToolInstanceModel.bulkWrite(ops);
}

// ---------------------------------------------------------------------------
// Bootstrap — called on first farm load for new players
// ---------------------------------------------------------------------------

/**
 * Seeds the four starter Wood tools for a new player. Idempotent via upserts.
 */
export async function seedStarterTools(owner: string): Promise<void> {
  await connectDatabase();
  const starters: Array<{ toolId: string; name: IToolInstance["name"]; tier: IToolInstance["tier"] }> = [
    { toolId: "axe-wood-default",         name: "Axe",          tier: "Wood" },
    { toolId: "pickaxe-wood-default",      name: "Pickaxe",      tier: "Wood" },
    { toolId: "rod-wood-default",          name: "Rod",          tier: "Wood" },
    { toolId: "wateringcan-wood-default",  name: "Watering Can", tier: "Wood" },
  ];
  await ToolInstanceModel.bulkWrite(
    starters.map((s) => ({
      updateOne: {
        filter: { owner, toolId: s.toolId },
        update: {
          $setOnInsert: {
            owner,
            toolId:        s.toolId,
            name:          s.name,
            tier:          s.tier,
            durability:    null,
            maxDurability: null,
          },
        },
        upsert: true,
      },
    })),
  );
}

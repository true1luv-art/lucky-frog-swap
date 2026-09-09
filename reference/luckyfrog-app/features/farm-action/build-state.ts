/**
 * features/farm-action/build-state.ts
 *
 * Converts MongoDB documents into the Phaser `GameState` expected by
 * `processGameEvent`. §2.2-B / §2.2-C
 *
 * Pipeline:
 *   MongoDB docs → buildServerGameState() → GameState
 *               → processGameEvent()       → nextState
 *               → persistFarmChanges()
 *
 * What changed from the previous revision:
 *   - `tools` no longer come from inventory.tools — they come from the
 *     dedicated `tools` collection via `IToolInstance[]`.
 *   - `equipment` no longer comes from farm.equipment — it is reconstructed
 *     from `IArmorPiece[]` + `IEquippedSet | null` by `buildEquipmentState()`.
 *   - `fishing` field removed (no cast cooldown with fast respawn).
 *   - `trees` / `stones` resource node builders removed (no per-node state).
 *   - `quests` now comes from `player.quests.daily` instead of `farm.quests.daily`.
 */

import Decimal from "decimal.js-light";
import type { IFarm, FieldNode, AnimalNode } from "@/lib/modules/farms/types.server";
import type { IInventory } from "@/lib/modules/items/types.server";
import type { IPlayer } from "@/lib/modules/players/types.server";
import type { IToolInstance } from "@/lib/modules/tools/types.server";
import type { GameState, GameNode, ChickenState, CowState, SheepState, Items } from "@/features/types/gameplay/game";
import type { PlayerSkills } from "@/features/types/gameplay/skills";
import type { ToolInstance } from "@/features/types/gameplay/tools";
import { INITIAL_SKILLS } from "@/features/types/gameplay/skills";
import { createInitialEquipment } from "@/features/types/gameplay/equipment";
import { STAMINA_CONSTANTS } from "@/features/game/stamina";

// ---------------------------------------------------------------------------
// FieldNode map conversion
// ---------------------------------------------------------------------------

function buildFields(
  fields: Record<string, FieldNode>,
): Record<number, GameNode> {
  const result: Record<number, GameNode> = {};
  for (const [key, node] of Object.entries(fields ?? {})) {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx)) continue;

    result[idx] = {
      name:      node.name as GameNode["name"],
      plantedAt: node.plantedAt,
      ...(node.wateredAt !== undefined ? { wateredAt: node.wateredAt } : {}),
      isWatered: node.isWatered ?? false,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Animal map conversion
// ---------------------------------------------------------------------------

function buildChickens(
  chickens: Record<string, AnimalNode>,
): Record<number, ChickenState> {
  const result: Record<number, ChickenState> = {};
  for (const [key, node] of Object.entries(chickens ?? {})) {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx)) continue;
    result[idx] = { fedAt: node.fedAt };
  }
  return result;
}

function buildCows(nodes: Record<string, AnimalNode>): Record<number, CowState> {
  const result: Record<number, CowState> = {};
  for (const [key, node] of Object.entries(nodes ?? {})) {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx)) continue;
    result[idx] = { fedAt: node.fedAt };
  }
  return result;
}

function buildSheep(nodes: Record<string, AnimalNode>): Record<number, SheepState> {
  const result: Record<number, SheepState> = {};
  for (const [key, node] of Object.entries(nodes ?? {})) {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx)) continue;
    result[idx] = { fedAt: node.fedAt };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Inventory conversion
// ---------------------------------------------------------------------------

/**
 * Converts MongoDB `items: Record<string,number>` into Phaser `Items` (Decimal values).
 * Tool names are excluded — they live in `state.tools[]` as ToolInstance objects.
 */
const TOOL_NAMES = new Set(["Axe", "Pickaxe", "Rod", "Watering Can"]);

function buildItems(inv: IInventory): { items: Items } {
  const result: Items = {};
  const raw = (inv.items ?? {}) as Record<string, number>;
  for (const [name, qty] of Object.entries(raw)) {
    if (TOOL_NAMES.has(name)) continue;
    if (qty > 0) {
      result[name as keyof Items] = new Decimal(qty);
    }
  }
  return { items: result };
}

// ---------------------------------------------------------------------------
// Skills conversion
// ---------------------------------------------------------------------------

function buildPhaserSkills(serverSkills: IPlayer["skills"]): PlayerSkills {
  const s = (serverSkills ?? {}) as unknown as Record<string, number>;
  return {
    farming:     s.farming     ?? 0,
    woodcutting: s.woodcutting ?? 0,
    mining:      s.mining      ?? 0,
    fishing:     s.fishing     ?? 0,
    husbandry:   s.husbandry   ?? 0,
    cooking:     s.cooking     ?? 0,
    smithing:    s.smithing    ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Tools conversion — IToolInstance[] → ToolInstance[]
// ---------------------------------------------------------------------------

function buildTools(docs: IToolInstance[]): ToolInstance[] {
  return docs.map((d) => ({
    id:            d.toolId,
    name:          d.name,
    tier:          d.tier,
    durability:    d.durability,
    maxDurability: d.maxDurability,
  }));
}

// ---------------------------------------------------------------------------
// Main converter §2.2-B
// ---------------------------------------------------------------------------

/**
 * Builds a complete Phaser `GameState` from MongoDB documents.
 *
 * @param farm      - Farm document (null → use empty defaults).
 * @param inventory - Inventory aggregate (null → empty items).
 * @param player    - Player document (skills, quests, milestones, username).
 * @param toolDocs  - Tool instance documents from the `tools` collection.
 */
export function buildServerGameState(
  farm:      IFarm | null,
  inventory: IInventory | null,
  player:    IPlayer,
  toolDocs:  IToolInstance[],
): GameState {
  const phaserSkills: PlayerSkills = buildPhaserSkills(player.skills);

  const { items } = inventory
    ? buildItems(inventory)
    : { items: {} };

  const tools = buildTools(toolDocs);

  const f = farm ?? ({} as Partial<IFarm>);

  return {
    id:        undefined,
    username:  player.username ?? undefined,
    avatarUrl: undefined,

    farmLevel: f.level ?? 1,

    fields:   buildFields((f.fields ?? {}) as Record<string, FieldNode>),

    // Resource nodes respawn locally in Phaser every 30 s — no DB persistence needed.
    trees:  {},
    stones: {},

    chickens: buildChickens((f.chickens ?? {}) as Record<string, AnimalNode>),
    cows:     buildCows((f.cows     ?? {}) as Record<string, AnimalNode>),
    sheep:    buildSheep((f.sheep   ?? {}) as Record<string, AnimalNode>),

    items,

    tools,
    equipment: createInitialEquipment(),

    farmAddress: undefined,
    skills: phaserSkills,

    // Coins — sourced from player.coins via the inventory balance field.
    coins: new Decimal(inventory?.balance ?? 0),

    // Stamina — persisted on the farm document; defaults to full on first load.
    // Guard against legacy documents where stamina was stored as a nested object
    // { current, max, lastRegenAt } before the schema was flattened to two Numbers.
    stamina: typeof f.stamina === "number"
      ? f.stamina
      : typeof (f.stamina as unknown as Record<string, number>)?.current === "number"
        ? (f.stamina as unknown as Record<string, number>).current
        : STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA,
    staminaRegenAt: typeof f.staminaRegenAt === "number"
      ? f.staminaRegenAt
      : typeof (f.stamina as unknown as Record<string, number>)?.lastRegenAt === "number"
        ? (f.stamina as unknown as Record<string, number>).lastRegenAt
        : 0,

    // Fishing: cooldown lives on player.activity.lastCastAt (anti-cheat timing),
    // not the farm document. Read it from the player param so the 30 s gate
    // is enforced correctly across sessions and farm resets.
    fishing: {
      lastCastAt:     player.activity?.lastCastAt ?? 0,
      lastCaughtFish: null,
    },

    milestones: ((player.milestones ?? {}) as unknown as Record<string, number>) as GameState["milestones"],

    // Quests now live on the player document, not the farm.
    quests: {
      daily: (player.quests?.daily ?? []) as GameState["quests"]["daily"],
    },
  };
}

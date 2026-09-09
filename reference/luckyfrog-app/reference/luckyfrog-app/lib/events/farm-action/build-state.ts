/**
 * lib/events/farm-action/build-state.ts
 *
 * Converts MongoDB farm + inventory + player documents into the Phaser
 * `GameState` shape expected by `processGameEvent`. §2.2-B / §2.2-C
 *
 * This is the "read side" of the server-side farm action pipeline:
 *   MongoDB docs → GameState → processGameEvent → nextState → persistFarmChanges
 *
 * Key design decisions:
 * - Phaser `GameState.inventory` uses `Decimal` values; we convert number → Decimal here.
 * - §C5 — Phaser `PlayerSkills` and the DB schema now both use `woodcutting`;
 *   the old `forestry ↔ woodcutting` alias was removed (names match 1:1).
 * - Resource nodes (trees, stones, iron, gold) are keyed by numeric index in Phaser
 *   (`Record<number, GameNode>`) but stored as string keys in MongoDB Maps. We convert.
 * - Phaser `GameState.fields` is `Record<number, GameNode>` (number key); MongoDB stores
 *   string keys in the Map. We parse to number.
 * - Equipment and base stats default to INITIAL_EQUIPMENT / INITIAL_BASE_STATS since
 *   Phase 2 does not yet implement equipment — the frog system (Phase 1) manages that
 *   separately and is not yet wired into the farming game.
 *
 * Reference: docs/implementation_plans/phase-02-farming-backend.md §2.2-B
 */

import Decimal from "decimal.js-light";
import type { IFarm, FieldNode, ResourceNode, AnimalNode } from "@/lib/modules/farms/types.server";
import type { IInventory } from "@/lib/modules/inventories/types.server";
import type { IPlayer } from "@/lib/modules/players/types.server";
import type { GameState, GameNode, ChickenState, CowState, SheepState, Inventory } from "@/shared/types/gameplay/game";
import type { PlayerSkills, SkillBonus } from "@/shared/types/gameplay/skills";
import { INITIAL_BONUS, INITIAL_SKILLS } from "@/shared/types/gameplay/skills";
import { INITIAL_EQUIPMENT, INITIAL_BASE_STATS, computeStats } from "@/shared/types/gameplay/equipment";
import { computeBonus } from "@/shared/game/skills";
import {
  getCollectibleBonuses,
  mergeSkillAndCollectibleBonuses,
  normalizeOwnedCollectibles,
} from "@/shared/game/collectibles";
import type { CollectibleName } from "@/shared/types/gameplay/collectibles";

// ---------------------------------------------------------------------------
// FieldNode map conversion
// ---------------------------------------------------------------------------

/**
 * Converts the MongoDB `fields` Map (string keys) into the Phaser
 * `Record<number, GameNode>` shape.
 */
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
      amount:    1,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// ResourceNode map conversion (trees, stones, iron, gold)
// ---------------------------------------------------------------------------

/**
 * Converts a MongoDB resource Map (string keys) into Phaser `Record<number, GameNode>`.
 * The `choppedAt` / `minedAt` fields on Phaser GameNode are mapped from
 * the server `harvestedAt` field. Both are Unix ms timestamps.
 */
function buildResourceNodes(
  nodes: Record<string, ResourceNode>,
  isTree: boolean,
): Record<number, GameNode> {
  const result: Record<number, GameNode> = {};
  for (const [key, node] of Object.entries(nodes ?? {})) {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx)) continue;
    result[idx] = {
      name:      node.name as GameNode["name"],
      amount:    node.amount,
      // Phaser uses choppedAt for trees, minedAt for ores
      ...(isTree
        ? { choppedAt: node.harvestedAt }
        : { minedAt:   node.harvestedAt }),
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
    result[idx] = { fedAt: node.fedAt, multiplier: node.multiplier };
  }
  return result;
}

function buildCows(nodes: Record<string, AnimalNode>): Record<number, CowState> {
  const result: Record<number, CowState> = {};
  for (const [key, node] of Object.entries(nodes ?? {})) {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx)) continue;
    result[idx] = { fedAt: node.fedAt, multiplier: node.multiplier };
  }
  return result;
}

function buildSheep(nodes: Record<string, AnimalNode>): Record<number, SheepState> {
  const result: Record<number, SheepState> = {};
  for (const [key, node] of Object.entries(nodes ?? {})) {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx)) continue;
    result[idx] = { fedAt: node.fedAt, multiplier: node.multiplier };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Inventory conversion
// ---------------------------------------------------------------------------

/**
 * Converts MongoDB `items: Record<string,number>` + `balance: number`
 * into Phaser `Inventory` (Decimal values) and `balance` (Decimal).
 */
function buildInventory(inv: IInventory): { inventory: Inventory; balance: Decimal } {
  const inventory: Inventory = {};
  const items = (inv.items ?? {}) as Record<string, number>;
  for (const [name, qty] of Object.entries(items)) {
    if (qty > 0) {
      inventory[name as keyof Inventory] = new Decimal(qty);
    }
  }
  return {
    inventory,
    balance: new Decimal(inv.balance ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Skills conversion: server → Phaser
// §C5 — Phaser now uses canonical server names (woodcutting, not forestry)
// ---------------------------------------------------------------------------

/**
 * Maps the server `PlayerSkills` to Phaser `PlayerSkills`.
 * Names now match exactly; no alias conversion needed.
 */
function buildPhaserSkills(serverSkills: IPlayer["skills"]): PlayerSkills {
  const s = serverSkills ?? {};
  return {
    farming:     s.farming     ?? 0,
    woodcutting: s.woodcutting ?? 0,
    mining:      s.mining      ?? 0,
    fishing:     s.fishing     ?? 0,
    cooking:     s.cooking     ?? 0,
    combat:      s.combat      ?? 0,
    husbandry:   s.husbandry   ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Main converter §2.2-B
// ---------------------------------------------------------------------------

/**
 * Builds a complete Phaser `GameState` from the three MongoDB documents.
 * The resulting `GameState` is passed directly to `processGameEvent`.
 *
 * @param farm      - The farm document (or null → use empty defaults).
 * @param inventory - The inventory document (or null → empty).
 * @param player    - The player document (provides skills, username, avatar).
 */
export function buildServerGameState(
  farm:      IFarm | null,
  inventory: IInventory | null,
  player:    IPlayer,
  ownedCollectibleNames: readonly CollectibleName[] = [],
): GameState {
  // Skills + server-derived collectible ownership bonuses
  const phaserSkills: PlayerSkills = farm
    ? buildPhaserSkills(player.skills)
    : { ...INITIAL_SKILLS };
  const ownedCollectibles = normalizeOwnedCollectibles(ownedCollectibleNames);
  const bonus: SkillBonus = mergeSkillAndCollectibleBonuses(
    computeBonus(phaserSkills),
    getCollectibleBonuses(ownedCollectibles),
  );

  // Equipment — Phase 2 does not yet wire frog equipment; use defaults
  const equipment = { ...INITIAL_EQUIPMENT };
  const baseStats  = { ...INITIAL_BASE_STATS };
  const stats      = computeStats(baseStats, equipment);

  // Inventory
  const { inventory: inv, balance } = inventory
    ? buildInventory(inventory)
    : { inventory: {}, balance: new Decimal(0) };

  // Farm nodes (default to empty if no farm yet)
  const f = farm ?? ({} as Partial<IFarm>);

  return {
    id:        undefined,
    username:  player.username ?? undefined,
    avatarUrl: undefined,

    balance,

    fields:   buildFields((f.fields ?? {}) as Record<string, FieldNode>),
    trees:    buildResourceNodes((f.trees  ?? {}) as Record<string, ResourceNode>, true),
    stones:   buildResourceNodes((f.stones ?? {}) as Record<string, ResourceNode>, false),
    iron:     buildResourceNodes((f.iron   ?? {}) as Record<string, ResourceNode>, false),
    gold:     buildResourceNodes((f.gold   ?? {}) as Record<string, ResourceNode>, false),

    chickens: buildChickens((f.chickens ?? {}) as Record<string, AnimalNode>),
    cows:     buildCows((f.cows     ?? {}) as Record<string, AnimalNode>),
    sheep:    buildSheep((f.sheep   ?? {}) as Record<string, AnimalNode>),

    inventory: inv,
    farmAddress: undefined,

    equipment,
    baseStats,
    stats,
    skills: phaserSkills,
    bonus,
    ownedCollectibles,

    stamina: {
      current: f.stamina?.current ?? 100,
      max:     f.stamina?.max     ?? 100,
    },
    lastStaminaRegenAt: f.stamina?.lastRegenAt ?? Date.now(),

    fishing: {
      lastCastAt:       f.fishing?.lastCastAt       ?? 0,
      cooldownMs:       f.fishing?.cooldownMs,
      lastCaughtFish:   (f.fishing?.lastCaughtFish  ?? null) as GameState["fishing"]["lastCaughtFish"],
      lastCaughtAmount: f.fishing?.lastCaughtAmount ?? 0,
      totalCasts:       f.fishing?.totalCasts       ?? 0,
      totalCaught:      f.fishing?.totalCaught      ?? 0,
    },

    cooking: f.cooking
      ? {
          item:      f.cooking.item as GameState["cooking"] extends { item: infer I } ? I : never,
          startedAt: f.cooking.startedAt,
          duration:  f.cooking.duration,
        }
      : null,

    activity:     (f.activity     ?? {}) as GameState["activity"],
    achievements: (f.achievements ?? {}) as GameState["achievements"],

    // Action-replay uses base (Genesis) scaling; the halving-aware buy/sell
    // pricing lives in the dedicated inventory routes. §5 Step 4.
    halvingMultiplier: 1,
  };
}

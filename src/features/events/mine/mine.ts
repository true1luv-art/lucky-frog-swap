import Decimal from "decimal.js-light";
import type { GameState, GameNode } from "@/features/types/gameplay/game";
import { getSkillXP } from "@/features/game/skills";
import { trackMilestone } from "@/features/game/milestones";
import { STONE_RECOVERY_SECONDS, MINE_ACTION_MS } from "@/features/game/resources";
import type { OreType } from "@/features/types/gameplay/resources";
import type { ToolTier } from "@/features/types/gameplay/tools";
import { TOOL_SPEED_BOOST, decrementDurability } from "@/features/types/gameplay/tools";

// ---------------------------------------------------------------------------
// Action type — stone-only, no scene
// ---------------------------------------------------------------------------

export type MineAction = {
  type: "stone.mined";
  index: number;
};

// ---------------------------------------------------------------------------
// Pickaxe-tier loot tables
//
// Stone is always guaranteed (1 unit per swing).
// Each OreChance entry is rolled independently — player Luck (flat %) is added
// directly to baseChance before each roll.
//
// Design intent:
//   Wood  → Iron drop chance so the player can always progress to Iron pick.
//   Each upgrade tier opens the next ore tier and improves lower-tier rates.
// ---------------------------------------------------------------------------

type OreChance = { ore: OreType; baseChance: number };

/**
 * Drop table keyed by pickaxe tier.
 * Exported so UI can display the odds tooltip on each ore node.
 *
 * | Tier     | Iron | Silver | Emerald | Diamond | Ignisite |
 * |----------|------|--------|---------|---------|----------|
 * | Wood     |  10% |    —   |    —    |    —    |    —     |
 * | Iron     |  25% |   8%   |    —    |    —    |    —     |
 * | Silver   |  25% |  15%   |    5%   |    —    |    —     |
 * | Emerald  |  25% |  18%   |   10%   |    3%   |    —     |
 * | Diamond  |  25% |  18%   |   12%   |    6%   |    2%    |
 * | Ignisite |  25% |  20%   |   15%   |    8%   |    4%    |
 */
export const PICKAXE_LOOT: Record<ToolTier, OreChance[]> = {
  Wood: [
    { ore: "Iron",    baseChance: 10 },
  ],
  Iron: [
    { ore: "Iron",   baseChance: 25 },
    { ore: "Silver", baseChance:  8 },
  ],
  Silver: [
    { ore: "Iron",    baseChance: 25 },
    { ore: "Silver",  baseChance: 15 },
    { ore: "Emerald", baseChance:  5 },
  ],
  Emerald: [
    { ore: "Iron",    baseChance: 25 },
    { ore: "Silver",  baseChance: 18 },
    { ore: "Emerald", baseChance: 10 },
    { ore: "Diamond", baseChance:  3 },
  ],
  Diamond: [
    { ore: "Iron",     baseChance: 25 },
    { ore: "Silver",   baseChance: 18 },
    { ore: "Emerald",  baseChance: 12 },
    { ore: "Diamond",  baseChance:  6 },
    { ore: "Ignisite", baseChance:  2 },
  ],
  Ignisite: [
    { ore: "Iron",     baseChance: 25 },
    { ore: "Silver",   baseChance: 20 },
    { ore: "Emerald",  baseChance: 15 },
    { ore: "Diamond",  baseChance:  8 },
    { ore: "Ignisite", baseChance:  4 },
  ],
};

/**
 * Rolls ore drops for a given pickaxe tier and player Luck stat.
 * Each ore entry is rolled independently.
 * Luck is a flat percent added to each baseChance (e.g. luck=5 means +5%).
 */
function rollOreLoot(tier: ToolTier, luck: number, rng: () => number): OreType[] {
  const dropped: OreType[] = [];
  for (const { ore, baseChance } of PICKAXE_LOOT[tier]) {
    const chance = baseChance + luck;
    if (rng() * 100 < chance) {
      dropped.push(ore);
    }
  }
  return dropped;
}

// ---------------------------------------------------------------------------
// mine() — isomorphic game event
// ---------------------------------------------------------------------------

export function mine(
  { state, action, createdAt = Date.now(), rng = Math.random }: {
    state:      GameState;
    action:     MineAction;
    createdAt?: number;
    rng?:       () => number;
  },
): GameState {
  // Find Pickaxe in tools[]
  const pickaxeIdx = state.tools.findIndex((t) => t.name === "Pickaxe");
  if (pickaxeIdx === -1) throw new Error("No pickaxe — craft one at the Blacksmith");
  const pickaxe = state.tools[pickaxeIdx];

  // Cooldown check — base reduced by tool tier boost
  const boost      = TOOL_SPEED_BOOST[pickaxe.tier];
  const cooldownMs = MINE_ACTION_MS * (1 - boost);
  void cooldownMs; // server-side enforcement; client uses this for UI lock

  // Auto-initialise: a missing entry means the node has never been mined —
  // treat it as fresh (minedAt = 0) rather than throwing.
  const rock: GameNode = (state.stones[action.index] as GameNode | undefined)
    ?? { name: "Stone", minedAt: 0 };

  // Recovery check — stone must have fully regenerated
  if (createdAt - (rock.minedAt ?? 0) <= STONE_RECOVERY_SECONDS * 1000) {
    throw new Error("Rock is still recovering");
  }

  // Luck from player stats (flat %; default 0)
  const luck = state.playerStats?.luck ?? 0;

  // Loot — guaranteed 1 Stone + RNG ore drops based on pickaxe tier
  const oreDrops = rollOreLoot(pickaxe.tier, luck, rng);

  // Apply Stone drop
  let nextItems = { ...state.items };
  const stoneCount = new Decimal((nextItems as Record<string, Decimal>)["Stone"] ?? 0);
  nextItems = { ...nextItems, Stone: stoneCount.add(1) };

  // Apply any ore drops
  for (const ore of oreDrops) {
    const current = new Decimal((nextItems as Record<string, Decimal>)[ore] ?? 0);
    nextItems = { ...nextItems, [ore]: current.add(1) };
  }

  // Decrement Pickaxe durability — remove from tools[] when broken
  const decremented = decrementDurability(pickaxe);
  const nextTools   = [...state.tools];
  if (decremented === null) {
    nextTools.splice(pickaxeIdx, 1);
  } else {
    nextTools[pickaxeIdx] = decremented;
  }

  // XP — 50 per mine action
  const newMiningXP = state.skills.mining + getSkillXP("mine_stone");

  return {
    ...state,
        items: nextItems, // keep alias in sync
    tools: nextTools,
    stones: {
      ...state.stones,
      [action.index]: {
        name:    "Stone" as const,
        minedAt: createdAt,
      },
    },
    skills:     { ...state.skills, mining: newMiningXP },
    milestones: trackMilestone(state.milestones, "Stone Mined", 1),
  };
}

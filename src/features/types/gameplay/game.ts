import Decimal from "decimal.js-light";
import type { GameEvent } from "@/features/events";
import { CropName, SeedName } from "@/features/types/gameplay/crops";
import { CraftableName, Food } from "@/features/types/gameplay/craftables";
import { ResourceName } from "@/features/types/gameplay/resources";
import { FishName } from "@/features/types/gameplay/fish";
import { PlayerSkills } from "@/features/types/gameplay/skills";
import { Milestones } from "@/features/types/gameplay/milestones";
import { EquipmentState } from "@/features/types/gameplay/equipment";
import type { ToolInstance } from "@/features/types/gameplay/tools";
import type { PlayerStats } from "@/features/types/player-stats";
import type { EmbeddedQuest } from "@/features/types/quests";

export type Reward = {
  items: { name: InventoryItemName; amount: number }[];
};

export type GameNode = {
  name: CropName | "Wood" | "Stone";
  plantedAt?: number;
  /** Unix timestamp (ms) when this plot was watered. Undefined until watered. */
  wateredAt?: number;
  /**
   * Explicit boolean: true once the player has watered the plot.
   * Readiness = isWatered && Date.now() >= wateredAt + growthMs.
   */
  isWatered?: boolean;
  choppedAt?: number;
  minedAt?:   number;
  reward?:    Reward;
};

export type ChickenState = {
  fedAt?: number;
};

export type CowState = {
  fedAt?: number;
};

export type SheepState = {
  fedAt?: number;
};


export type FishingState = {
  lastCastAt:     number;
  lastCaughtFish: FishName | null;
};

/**
 * InventoryItemName — all stackable item names (tools removed; Shard added).
 * Tools live in `state.tools[]` as ToolInstance objects, not as Decimal counts.
 */
export type InventoryItemName =
  | CropName
  | SeedName
  | CraftableName
  | ResourceName
  | FishName
  | "Shard";

/** Stackable items map — formerly called `Inventory`. */
export type Items = Partial<Record<InventoryItemName, Decimal>>;

/** @deprecated Use Items instead. */
export type Inventory = Items;

type PastAction = GameEvent & { createdAt: Date };

export type GameState = {
  id?: number;
  username?: string;
  avatarUrl?: string;
  farmAddress?: string;
  /**
   * Farm expansion level (1–10). Gated on totalSkillXp + Wood/Stone/Gold spend.
   * Level 1 is the starting state. Incremented via "farm.upgrade" action.
   */
  farmLevel: number;
  fields:   Record<number, GameNode>;
  trees:    Record<number, GameNode>;
  /** All ore nodes — stone is guaranteed; ores drop by biome loot table. */
  stones:   Record<number, GameNode>;
  chickens: Record<number, ChickenState>;
  cows:     Record<number, CowState>;
  sheep:    Record<number, SheepState>;
  /**
   * Stackable items (resources, crops, seeds, food, fish, currency, shards).
   * Tools are NOT stored here — they live in `tools[]`.
   * Renamed from `inventory` to `items` to reflect the broader scope.
   */
  items: Items;
  /**
   * Owned tool instances. Each has its own durability.
   * Wood tools have null durability (infinite). Ore-tier tools break when
   * durability reaches 0 and are removed from this array.
   */
  tools: ToolInstance[];
  skills: PlayerSkills;
  /** Armor set (head/body/leg/feet) — renamed from `equipment`. */
  equipment: EquipmentState;
  /**
   * Aggregate equipment stats — sum of all equipped item bonuses.
   * Recomputed by equip/upgrade events and persisted to `player.stats`.
   * Optional so old state shapes don't break; defaults to zero-valued object.
   */
  playerStats?: PlayerStats;
  /**
   * In-game coin balance. Earned by selling resources, crops, and food.
   * Spent on seed purchases.
   */
  coins: Decimal;
  /**
   * Current HP. Restored by eating cooked food.
   */
  hp: number;
  fishing: FishingState;
  milestones: Milestones;
  /**
   * Player's active quests — daily board that rotates daily.
   * Quests are embedded here rather than in a separate collection.
   */
  quests: {
    daily: EmbeddedQuest[];
  };
};

export interface Context {
  state?: GameState;
  actions: PastAction[];
}

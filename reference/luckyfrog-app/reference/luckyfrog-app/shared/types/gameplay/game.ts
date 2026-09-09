import Decimal from "decimal.js-light";
import type { GameEvent } from "@/lib/events";
import { CropName, SeedName } from "@/shared/types/gameplay/crops";
import { CraftableName, Food } from "@/shared/types/gameplay/craftables";
import { ResourceName } from "@/shared/types/gameplay/resources";
import { FishName } from "@/shared/types/gameplay/fish";
import { PlayerSkills, SkillBonus } from "@/shared/types/gameplay/skills";
import { PlayerEquipment, EquipmentAttributes } from "@/shared/types/gameplay/equipment";
import { Activity, AchievementName } from "@/shared/types/gameplay/achievements";
import type { CollectibleName } from "@/shared/types/gameplay/collectibles";

export type Reward = {
  items: { name: InventoryItemName; amount: number }[];
};

export type GameNode = {
  name: CropName | "Wood" | "Stone" | "Iron" | "Gold";
  plantedAt?: number;
  choppedAt?: number;
  minedAt?:   number;
  amount:     number;
  reward?:    Reward;
};

export type ChickenState = {
  fedAt?: number;
  multiplier: number;
};

export type CowState = {
  fedAt?: number;
  multiplier: number;
};

export type SheepState = {
  fedAt?: number;
  multiplier: number;
};

export type ChickenPosition = {
  top: number;
  right: number;
};

export type FishingState = {
  lastCastAt:       number;
  cooldownMs?:      number;
  lastCaughtFish:   FishName | null;
  lastCaughtAmount: number;
  totalCasts:       number;
  totalCaught:      number;
};

export type InventoryItemName =
  | CropName
  | SeedName
  | CraftableName
  | ResourceName
  | FishName;

export type Inventory = Partial<Record<InventoryItemName, Decimal>>;

export type Stamina = {
  current: number;
  max: number;
};

export type CookingSlot = {
  item:      Food;
  startedAt: number;
  duration:  number;
} | null;

type PastAction = GameEvent & { createdAt: Date };

export type GameState = {
  id?: number;
  username?: string;
  avatarUrl?: string;
  balance: Decimal;
  fields:   Record<number, GameNode>;
  trees:    Record<number, GameNode>;
  stones:   Record<number, GameNode>;
  iron:     Record<number, GameNode>;
  gold:     Record<number, GameNode>;
  chickens: Record<number, ChickenState>;
  cows:     Record<number, CowState>;
  sheep:    Record<number, SheepState>;
  inventory: Inventory;
  farmAddress?: string;
  equipment:  PlayerEquipment;
  baseStats:  EquipmentAttributes;
  stats:      EquipmentAttributes;
  skills: PlayerSkills;
  bonus:  SkillBonus;
  ownedCollectibles: CollectibleName[];
  stamina: Stamina;
  lastStaminaRegenAt: number;
  fishing: FishingState;
  cooking: CookingSlot;
  activity: Activity;
  achievements: Partial<Record<AchievementName, number>>;
  /**
   * Current LFRG emission multiplier from the halving schedule.
   * Fetched from GET /api/game-stats on game load and used to scale
   * client-side buy/sell prices (CROPS()/SEEDS()). Default: 1 (Genesis).
   *
   * Optional so the many existing GameState builders/fixtures stay
   * backward-compatible; all consumers fall back to `1` when absent.
   * See docs/halving-price-integration.md §5 Step 4.
   */
  halvingMultiplier?: number;
};

export interface Context {
  state?: GameState;
  actions: PastAction[];
}

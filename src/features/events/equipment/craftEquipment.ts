import Decimal from "decimal.js-light";
import type { GameState } from "@/features/types/gameplay/game";
import type {
  EquipmentItem,
  EquipmentSlot,
  EquipmentTier,
} from "@/features/types/gameplay/equipment";
import { createInitialEquipment } from "@/features/types/gameplay/equipment";
import { getCraftRecipe, rollEquipmentStats } from "@/features/game/equipment";
import { seededRng } from "@/features/game/rng";
import { getSkillXP } from "@/features/game/skills";
import type { ResourceName } from "@/features/types/gameplay/resources";

export type CraftEquipmentAction = {
  type: "equipment.craft";
  tier: EquipmentTier;
  slot: EquipmentSlot;
};

type Options = { state: GameState; action: CraftEquipmentAction };

/** Generates a short unique id for a crafted piece. */
function newId(): string {
  return `eq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * craftEquipment — consumes the recipe's ore inputs, rolls random stats for the
 * given tier, and adds the new piece to the owned list. Grants smithing XP.
 */
export function craftEquipment({ state, action }: Options): GameState {
  const { tier, slot } = action;

  const recipe = getCraftRecipe(tier);
  const items = { ...state.items };

  // Validate + deduct ore inputs.
  for (const [name, amount] of Object.entries(recipe) as [ResourceName, number][]) {
    const have = new Decimal(items[name] ?? 0);
    if (have.lessThan(amount)) {
      throw new Error(`Not enough ${name} to craft ${tier} ${slot}`);
    }
    items[name] = have.sub(amount);
  }

  const equipment = state.equipment ?? createInitialEquipment();

  // Deterministic stat roll: seed combines the generated id with tier+slot so
  // the same craft request always produces the same stats (replay-safe).
  const id  = newId();
  const rng = seededRng(`${id}@${tier}@${slot}`);

  const piece: EquipmentItem = {
    id,
    tier,
    slot,
    stats: rollEquipmentStats(tier, rng),
    upgradeLevel: 0,
  };

  const smithingXP = (state.skills.smithing ?? 0) + getSkillXP("smith_action");

  return {
    ...state,
    items,
    equipment: {
      ...equipment,
      owned: [...equipment.owned, piece],
    },
    skills: { ...state.skills, smithing: smithingXP },
  };
}

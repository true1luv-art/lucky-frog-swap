import Decimal from "decimal.js-light";
import { GameState } from "@/shared/types/gameplay/game";
import { getSkillXP, getSkillLevel } from "@/shared/game/skills";
import { rollCatch } from "@/shared/game/fishing";
import { hasEnoughStamina, deductStamina } from "@/shared/game/stamina";
import { trackActivity } from "@/shared/game/activity";
import { INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { FISHING_BASE_COOLDOWN_MS, FISHING_MIN_COOLDOWN_MS } from "@/shared/game/constants";
import { getReducedDuration } from "@/shared/game/boosts";
import { recomputeOwnedBonuses } from "@/shared/game/collectibles";

export type CatchFishAction = { type: "fish.caught"; createdAt: number };
type Options = { state: GameState; action: CatchFishAction };

export function catchFish({ state, action }: Options): GameState {
  const { createdAt } = action;

  if (!hasEnoughStamina(state.stamina.current, "fish_cast")) throw new Error("Not enough stamina to fish");

  const previousCooldown = state.fishing.cooldownMs ?? FISHING_BASE_COOLDOWN_MS;
  if (createdAt - (state.fishing.lastCastAt ?? 0) < previousCooldown) throw new Error("Fishing is on cooldown");
  const effectiveCooldown = Math.max(
    FISHING_MIN_COOLDOWN_MS,
    getReducedDuration(FISHING_BASE_COOLDOWN_MS, state.bonus.fishSpeed ?? 0),
  );

  const fishingXP    = state.skills.fishing ?? 0;
  const fishingLevel = getSkillLevel(fishingXP);
  const caught       = rollCatch(fishingLevel);

  const bonus  = state.bonus ?? { ...INITIAL_BONUS };
  let amount   = Math.max(1, Math.floor(1 * (1 + (bonus.fishYield ?? 0))));
  if (Math.random() < (bonus.fishDouble ?? 0)) amount *= 2;

  const catchXP      = getSkillXP("catch_fish");
  const newFishingXP = fishingXP + catchXP;
  const oldLevel     = getSkillLevel(fishingXP);
  const newLevel     = getSkillLevel(newFishingXP);
  const newBonus     = newLevel > oldLevel && newLevel % 10 === 0
    ? recomputeOwnedBonuses(
        { ...state.skills, fishing: newFishingXP },
        state.ownedCollectibles,
      )
    : bonus;

  const current = new Decimal(state.inventory[caught] ?? 0);

  return {
    ...state,
    inventory: { ...state.inventory, [caught]: current.add(amount) },
    skills:    { ...state.skills, fishing: newFishingXP },
    bonus:     newBonus,
    stamina:   { ...state.stamina, current: deductStamina(state.stamina.current, "fish_cast") },
    fishing: {
      lastCastAt:       createdAt,
      cooldownMs:       effectiveCooldown,
      lastCaughtFish:   caught,
      lastCaughtAmount: amount,
      totalCasts:       (state.fishing.totalCasts ?? 0) + 1,
      totalCaught:      (state.fishing.totalCaught ?? 0) + 1,
    },
    activity: trackActivity(state.activity, "Fish Caught", 1),
  };
}

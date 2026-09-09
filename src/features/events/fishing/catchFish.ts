import Decimal from "decimal.js-light";
import { GameState } from "@/features/types/gameplay/game";
import { getFishXP, getSkillLevel } from "@/features/game/skills";
import { rollCatch } from "@/features/game/fishing";
import { trackMilestone } from "@/features/game/milestones";
import type { MilestoneName } from "@/features/types/gameplay/milestones";
import { FISHING_ACTION_MS } from "@/features/game/fishing";
import { decrementDurability } from "@/features/types/gameplay/tools";

export type CatchFishAction = { type: "fish.caught"; createdAt: number };
type Options = { state: GameState; action: CatchFishAction };

export function catchFish({ state, action }: Options): GameState {
  const { createdAt } = action;

  // Rod is now a ToolInstance in state.tools[] — not a stackable inventory item
  const rodIdx = state.tools.findIndex((t) => t.name === "Rod");
  if (rodIdx === -1) throw new Error("No Rod — craft one at the Blacksmith");

  if (createdAt - (state.fishing.lastCastAt ?? 0) < FISHING_ACTION_MS) throw new Error("Fishing is on cooldown");

  const fishingXP    = state.skills.fishing ?? 0;
  const fishingLevel = getSkillLevel(fishingXP);
  const caught       = rollCatch(fishingLevel);

  const catchXP      = getFishXP(caught);
  const newFishingXP = fishingXP + catchXP;

  // Decrement Rod durability (Wood Rod has null durability = infinite)
  const decremented = decrementDurability(state.tools[rodIdx]);
  const nextTools   = [...state.tools];
  if (decremented === null) {
    nextTools.splice(rodIdx, 1); // durability hit 0 → consumed
  } else {
    nextTools[rodIdx] = decremented;
  }

  const current   = new Decimal(state.items[caught] ?? 0);
  const nextItems = { ...state.items, [caught]: current.add(1) };

  return {
    ...state,
        items: nextItems, // alias
    tools:     nextTools,
    skills:    { ...state.skills, fishing: newFishingXP },
    fishing: {
      lastCastAt:     createdAt,
      lastCaughtFish: caught,
    },
    milestones: trackMilestone(
      trackMilestone(state.milestones, "Fish Caught", 1),
      `${caught} Caught` as MilestoneName,
      1,
    ),
  };
}

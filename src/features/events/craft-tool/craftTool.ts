/**
 * features/events/craft-tool/craftTool.ts
 *
 * Craft tools at the Workbench.
 * Tools are now `ToolInstance` objects in `state.tools[]` — not stackable items.
 * Wood tools are free, infinite (null durability), capped at 1 per name.
 * Ore-tier tools cost 3 of their matching ingot, have finite durability, and
 * grant a speed boost to mining/chopping/fishing/watering.
 */

import Decimal from "decimal.js-light";
import type { ToolName, ToolTier } from "@/features/types/gameplay/tools";
import { TOOL_CRAFT_RECIPES, createToolInstance } from "@/features/types/gameplay/tools";
import { TOOLS } from "@/features/types/gameplay/craftables";
import { getSkillXP } from "@/features/game/skills";
import { GameState } from "@/features/types/gameplay/game";

export type CraftToolAction = {
  type: "tool.crafted";
  tool: ToolName;
  /** Tier to craft (defaults to "Wood" for free starter tools). */
  tier?: ToolTier;
};

type Options = { state: GameState; action: CraftToolAction };

export function craftTool({ state, action }: Options): GameState {
  const toolDefs = TOOLS();
  const config   = toolDefs[action.tool];
  if (!config) throw new Error(`Unknown tool: "${action.tool}"`);

  const tier: ToolTier = action.tier ?? "Wood";

  // Wood tools: free but capped at 1 per tool name
  if (tier === "Wood") {
    const alreadyOwns = state.tools.some((t) => t.name === action.tool && t.tier === "Wood");
    if (alreadyOwns) {
      throw new Error(`You already own a Wood ${action.tool} — you can only hold 1`);
    }
    const newTool = createToolInstance(action.tool, "Wood");
    return {
      ...state,
      tools: [...state.tools, newTool],
    };
  }

  // Ore-tier tools: deduct 3 matching ingots
  const recipe = TOOL_CRAFT_RECIPES[tier];
  let nextItems = { ...state.items };
  for (const [ingredient, qty] of Object.entries(recipe)) {
    const amount = qty ?? 0; // qty is number | undefined from Partial<Record<…>>
    const have = new Decimal((nextItems as Record<string, Decimal>)[ingredient] ?? 0);
    if (have.lt(amount)) throw new Error(`Not enough ${ingredient} (need ${amount}, have ${have.toNumber()})`);
    nextItems = { ...nextItems, [ingredient]: have.sub(amount) };
  }

  const newTool  = createToolInstance(action.tool, tier);
  const smithXP  = (state.skills.smithing ?? 0) + getSkillXP("smith_action");

  return {
    ...state,
        items: nextItems, // alias
    tools:     [...state.tools, newTool],
    skills:    { ...state.skills, smithing: smithXP },
  };
}

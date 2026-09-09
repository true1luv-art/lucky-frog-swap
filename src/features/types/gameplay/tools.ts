/**
 * features/types/gameplay/tools.ts
 *
 * All tool-related types and config.
 *
 * Tools are NOT stackable — each owned instance lives in `state.tools[]`
 * as a `ToolInstance` with its own durability counter.
 *
 * Wood tools are free, infinite (durability = null), and capped at 1 owned.
 * Ore-tier tools have finite durability and a time-reduction speed boost.
 * Each tool is crafted from 3 of its matching ingot only — no mixing.
 */

export type ToolName = "Axe" | "Pickaxe" | "Rod" | "Watering Can";

/** Tiers that map to ore types (plus Wood as the free starter). */
export type ToolTier = "Wood" | "Iron" | "Silver" | "Emerald" | "Diamond" | "Ignisite";

// ---------------------------------------------------------------------------
// Per-instance shape
// ---------------------------------------------------------------------------

export type ToolInstance = {
  /** Stable nanoid — survives serialisation/deserialisation. */
  id: string;
  name: ToolName;
  tier: ToolTier;
  /**
   * Current durability. `null` = infinite (Wood tier only).
   * Decremented by 1 per use; tool is removed from `tools[]` when it hits 0.
   */
  durability: number | null;
  maxDurability: number | null;
};

// ---------------------------------------------------------------------------
// Durability by tier
// ---------------------------------------------------------------------------

export const TOOL_MAX_DURABILITY: Record<ToolTier, number | null> = {
  Wood:     null,   // infinite — Wood tools are free and never break
  Iron:     125,
  Silver:   250,
  Emerald:  375,
  Diamond:  500,
  Ignisite: 1000,
};

// ---------------------------------------------------------------------------
// Speed boost by tier (fraction to subtract from base cooldown)
// ---------------------------------------------------------------------------

/**
 * Applied as: `actionMs = baseCooldownMs * (1 - boost)`
 *
 * | Tier     | Boost | 5 s base → effective |
 * |----------|-------|----------------------|
 * | Wood     | 0 %   | 5000 ms              |
 * | Iron     | 10 %  | 4500 ms              |
 * | Silver   | 20 %  | 4000 ms              |
 * | Emerald  | 30 %  | 3500 ms              |
 * | Diamond  | 40 %  | 3000 ms              |
 * | Ignisite | 50 %  | 2500 ms              |
 */
export const TOOL_SPEED_BOOST: Record<ToolTier, number> = {
  Wood:     0,
  Iron:     0.10,
  Silver:   0.20,
  Emerald:  0.30,
  Diamond:  0.40,
  Ignisite: 0.50,
};

// ---------------------------------------------------------------------------
// Craft recipes — pure single ingot per tier, 3 ingots each, no mixing
// ---------------------------------------------------------------------------

export const TOOL_CRAFT_RECIPES: Record<ToolTier, Partial<Record<string, number>>> = {
  Wood:     {},                            // free — no ingredient
  Iron:     { "Iron Ingot": 3 },           // pure Iron Ingot only
  Silver:   { "Silver Ingot": 3 },         // pure Silver Ingot only
  Emerald:  { "Emerald Ingot": 3 },        // pure Emerald Ingot only
  Diamond:  { "Diamond Ingot": 3 },        // pure Diamond Ingot only
  Ignisite: { "Ignisite Ingot": 3 },       // pure Ignisite Ingot only
};

// ---------------------------------------------------------------------------
// Helper: build a fresh ToolInstance
// ---------------------------------------------------------------------------

let _idCounter = 0;
export function makeToolId(): string {
  return `tool_${Date.now()}_${++_idCounter}`;
}

export function createToolInstance(name: ToolName, tier: ToolTier): ToolInstance {
  const max = TOOL_MAX_DURABILITY[tier];
  return {
    id:            makeToolId(),
    name,
    tier,
    durability:    max,
    maxDurability: max,
  };
}

// ---------------------------------------------------------------------------
// Helper: decrement durability on a tool, returning null when it breaks
// ---------------------------------------------------------------------------

export function decrementDurability(tool: ToolInstance): ToolInstance | null {
  if (tool.durability === null) return tool;          // infinite — no change
  const next = tool.durability - 1;
  if (next <= 0) return null;                         // broken — caller removes it
  return { ...tool, durability: next };
}

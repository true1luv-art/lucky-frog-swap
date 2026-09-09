/**
 * features/game/foods.ts
 *
 * Legacy shim — food definitions have moved to features/types/gameplay/craftables.ts
 * (the FOODS() function). This file re-exports from there so any remaining
 * consumers that still import from this path continue to compile.
 */
export { FOODS as FOODS_CONFIG } from "@/features/types/gameplay/craftables";
export type { Food as FoodName } from "@/features/types/gameplay/craftables";

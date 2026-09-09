import { GameState } from "@/shared/types/gameplay/game";
import { calculateStaminaRegen, STAMINA_CONSTANTS } from "@/shared/game/stamina";

export type StaminaRegenAction = { type: "stamina.regenerate" };
type Options = { state: GameState; action: StaminaRegenAction };

export function staminaRegen({ state }: Options): GameState {
  const maxStamina = STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;
  const { newStamina, intervalsElapsed, newRegenAt } = calculateStaminaRegen(
    state.lastStaminaRegenAt,
    state.stamina.current,
    maxStamina,
  );
  if (intervalsElapsed === 0) return state;
  return {
    ...state,
    stamina:            { current: newStamina, max: maxStamina },
    lastStaminaRegenAt: newRegenAt,
  };
}

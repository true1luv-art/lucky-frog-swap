export const STAMINA_CONSTANTS = {
  DEFAULT_MAX_STAMINA: 100,
  REGEN_INTERVAL_MS: 60 * 60 * 1000,
  STAMINA_REGEN_PERCENT: 0.05,
  MAX_OFFLINE_REGEN_INTERVALS: 8,
};

export const STAMINA_COSTS = {
  harvest_crop:     1,
  harvest_resource: 1,
  chop_tree:        1,
  mine_stone:       1,
  mine_iron:        1,
  mine_gold:        1,
  plant:            0,
  fish_cast:        3,
} as const;

export type StaminaAction = keyof typeof STAMINA_COSTS;

export function calculateStaminaRegen(
  lastRegenAt: number,
  currentStamina: number,
  maxStamina: number,
): { newStamina: number; intervalsElapsed: number; newRegenAt: number } {
  const now = Date.now();
  const elapsed = now - lastRegenAt;
  const intervalsElapsed = Math.floor(elapsed / STAMINA_CONSTANTS.REGEN_INTERVAL_MS);

  if (intervalsElapsed === 0) {
    return { newStamina: currentStamina, intervalsElapsed: 0, newRegenAt: lastRegenAt };
  }

  const capped = Math.min(intervalsElapsed, STAMINA_CONSTANTS.MAX_OFFLINE_REGEN_INTERVALS);
  const regenAmount = Math.ceil(maxStamina * STAMINA_CONSTANTS.STAMINA_REGEN_PERCENT * capped);
  const newStamina = Math.min(currentStamina + regenAmount, maxStamina);
  const newRegenAt = lastRegenAt + capped * STAMINA_CONSTANTS.REGEN_INTERVAL_MS;

  return { newStamina, intervalsElapsed: capped, newRegenAt };
}

export function hasEnoughStamina(current: number, action: StaminaAction): boolean {
  return current >= STAMINA_COSTS[action];
}

export function deductStamina(current: number, action: StaminaAction): number {
  return Math.max(0, current - STAMINA_COSTS[action]);
}

export function getStaminaCost(action: StaminaAction): number {
  return STAMINA_COSTS[action];
}

export function getMaxStaminaForLevel(_level: number): number {
  return STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;
}

export function getTimeUntilNextRegen(lastRegenAt: number): number {
  const now = Date.now();
  return STAMINA_CONSTANTS.REGEN_INTERVAL_MS - ((now - lastRegenAt) % STAMINA_CONSTANTS.REGEN_INTERVAL_MS);
}

export function formatRegenTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const LFRG_EMISSION_ALLOCATION = 100_000_000;
export const LFRG_HALVING_INTERVAL = 20_000_000;

export interface HalvingStep {
  stage: 0 | 1 | 2 | 3 | 4;
  startsAt: number;
  endsAt: number;
  emissionMultiplier: number;
  label: string;
}

export const HALVING_SCHEDULE: readonly HalvingStep[] = [
  { stage: 0, startsAt: 0, endsAt: 20_000_000, emissionMultiplier: 1, label: "Genesis" },
  { stage: 1, startsAt: 20_000_000, endsAt: 40_000_000, emissionMultiplier: 0.5, label: "First Halving" },
  { stage: 2, startsAt: 40_000_000, endsAt: 60_000_000, emissionMultiplier: 0.25, label: "Second Halving" },
  { stage: 3, startsAt: 60_000_000, endsAt: 80_000_000, emissionMultiplier: 0.125, label: "Third Halving" },
  { stage: 4, startsAt: 80_000_000, endsAt: 100_000_000, emissionMultiplier: 0.0625, label: "Fourth Halving" },
] as const;

function normalizeEmission(totalLfrgEmitted: number): number {
  if (!Number.isFinite(totalLfrgEmitted)) return 0;
  return Math.max(0, totalLfrgEmitted);
}

export function getHalvingStage(totalLfrgEmitted: number): HalvingStep["stage"] {
  const emitted = normalizeEmission(totalLfrgEmitted);
  return Math.min(4, Math.floor(emitted / LFRG_HALVING_INTERVAL)) as HalvingStep["stage"];
}

export function getEmissionMultiplier(totalLfrgEmitted: number): number {
  return HALVING_SCHEDULE[getHalvingStage(totalLfrgEmitted)].emissionMultiplier;
}

export function getCurrentHalvingStep(totalLfrgEmitted: number): HalvingStep {
  return HALVING_SCHEDULE[getHalvingStage(totalLfrgEmitted)];
}

export function getNextHalvingThreshold(totalLfrgEmitted: number): number | null {
  const emitted = normalizeEmission(totalLfrgEmitted);
  if (emitted >= 80_000_000) return null;
  return (getHalvingStage(emitted) + 1) * LFRG_HALVING_INTERVAL;
}

export function getEmissionProgress(totalLfrgEmitted: number) {
  const emitted = normalizeEmission(totalLfrgEmitted);
  const step = getCurrentHalvingStep(emitted);
  const trancheEmitted = Math.min(LFRG_HALVING_INTERVAL, Math.max(0, emitted - step.startsAt));

  return {
    emitted,
    allocation: LFRG_EMISSION_ALLOCATION,
    allocationRemaining: Math.max(0, LFRG_EMISSION_ALLOCATION - emitted),
    allocationProgress: Math.min(1, emitted / LFRG_EMISSION_ALLOCATION),
    trancheEmitted,
    trancheRemaining: Math.max(0, step.endsAt - emitted),
    trancheProgress: Math.min(1, trancheEmitted / LFRG_HALVING_INTERVAL),
  };
}

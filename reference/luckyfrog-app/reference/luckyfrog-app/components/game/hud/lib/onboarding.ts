// Onboarding is not implemented in the offline-mode port.
// This stub satisfies any future imports of the onboarding lib.

export const ONBOARDING_STEPS = [] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingComplete(): boolean {
  return true;
}

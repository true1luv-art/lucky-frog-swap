/**
 * features/events/hero-stamina-regen/action.ts
 *
 * Pure event function for recovering energy on resting heroes.
 * No DB calls — operates on a plain roster snapshot.
 *
 * Rules:
 *  - Only heroes with onMap === false are eligible (resting heroes).
 *  - Energy is capped at maxEnergy.
 *  - deltaSec must be positive; zero or negative produces no change.
 *  - Rate: RECOVERY_FRACTION_PER_INTERVAL of maxEnergy per RECOVERY_INTERVAL_SECONDS.
 *    Example default: 10% of max per 5 min → full regen in ~50 min.
 */

import {
  RECOVERY_FRACTION_PER_INTERVAL,
  RECOVERY_INTERVAL_SECONDS,
} from "@/lib/constants/game";
import type { RosterHero } from "@/features/store/gameStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaminaRegenState {
  heroes: RosterHero[];
}

export interface StaminaRegenAction {
  /** Elapsed seconds since the last regen tick. Must be > 0. */
  deltaSec: number;
}

export interface StaminaRegenResult {
  ok:      boolean;
  error?:  string;
  code?:   string;
  /** Updated roster — only resting heroes with energy < max are changed. */
  roster?: RosterHero[];
  /** Number of heroes whose energy changed. */
  updatedCount?: number;
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

/**
 * heroStaminaRegen({ state, action })
 *
 * Pure function — returns a new roster with energy caught up for all resting
 * heroes. The caller is responsible for persisting the delta to the DB.
 */
export function heroStaminaRegen({
  state,
  action,
}: {
  state:  StaminaRegenState;
  action: StaminaRegenAction;
}): StaminaRegenResult {
  const { heroes } = state;
  const { deltaSec } = action;

  if (deltaSec <= 0) {
    return { ok: false, error: "deltaSec must be positive", code: "INVALID_DELTA" };
  }

  let updatedCount = 0;

  const roster = heroes.map((h) => {
    // Only resting heroes regen.
    if (h.onMap) return h;
    // Already full — skip.
    if (h.currentEnergy >= h.maxEnergy) return h;

    const gain = (h.maxEnergy * RECOVERY_FRACTION_PER_INTERVAL * deltaSec) / RECOVERY_INTERVAL_SECONDS;
    const next = Math.min(h.maxEnergy, h.currentEnergy + gain);

    if (next === h.currentEnergy) return h;

    updatedCount++;
    return { ...h, currentEnergy: next };
  });

  return { ok: true, roster, updatedCount };
}

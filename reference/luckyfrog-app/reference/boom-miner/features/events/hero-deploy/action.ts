/**
 * features/events/hero-deploy/action.ts
 *
 * Pure event function for deploying a hero onto the map.
 * No DB calls — operates on a plain state snapshot.
 *
 * Rules enforced:
 *  1. Hero must belong to the requesting wallet.
 *  2. Hero must not already be deployed.
 *  3. Hero must have at least 1 energy.
 *  4. Deployed count must be below MAX_ON_MAP.
 */

import { MAX_ON_MAP } from "@/lib/constants/game";
import type { RosterHero } from "@/features/store/gameStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeployState {
  wallet: string;
  heroes: RosterHero[];
}

export interface DeployAction {
  heroId: string;
}

export interface DeployResult {
  ok:      boolean;
  error?:  string;
  code?:   string;
  /** Updated hero snapshot when ok === true. */
  hero?:   RosterHero;
  /** Full updated roster. */
  roster?: RosterHero[];
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

/**
 * heroDeploy({ state, action })
 *
 * Pure function — returns a new roster with the target hero marked onMap:true.
 * No I/O; the route handler persists via the repository after calling this.
 */
export function heroDeploy({
  state,
  action,
}: {
  state:  DeployState;
  action: DeployAction;
}): DeployResult {
  const { heroes, wallet } = state;
  const { heroId } = action;

  const hero = heroes.find((h) => h.id === heroId);

  if (!hero) {
    return { ok: false, error: "Hero not found", code: "HERO_NOT_FOUND" };
  }
  if (hero.owner !== wallet) {
    return { ok: false, error: "Hero does not belong to this wallet", code: "NOT_OWNER" };
  }
  if (hero.onMap) {
    return { ok: false, error: "Hero is already deployed", code: "ALREADY_DEPLOYED" };
  }
  if (hero.currentEnergy < 1) {
    return {
      ok:    false,
      error: "Hero has no energy — rest it first",
      code:  "INSUFFICIENT_ENERGY",
    };
  }

  const deployedCount = heroes.filter((h) => h.onMap).length;
  if (deployedCount >= MAX_ON_MAP) {
    return {
      ok:    false,
      error: `Map is full — max ${MAX_ON_MAP} heroes allowed`,
      code:  "MAP_FULL",
    };
  }

  const updated: RosterHero = { ...hero, onMap: true };
  const roster = heroes.map((h) => (h.id === heroId ? updated : h));

  return { ok: true, hero: updated, roster };
}

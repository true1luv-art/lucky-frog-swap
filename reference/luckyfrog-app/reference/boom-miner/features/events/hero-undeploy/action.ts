/**
 * features/events/hero-undeploy/action.ts
 *
 * Pure event function for recalling a hero from the map.
 * No DB calls — operates on a plain state snapshot.
 *
 * Rules enforced:
 *  1. Hero must belong to the requesting wallet.
 *  2. Hero must currently be deployed (onMap === true).
 *
 * Note: undeploy is always allowed regardless of energy — the hero is
 * recalled to rest and will regenerate energy while off-map.
 */

import type { RosterHero } from "@/features/store/gameStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UndeployState {
  wallet: string;
  heroes: RosterHero[];
}

export interface UndeployAction {
  heroId: string;
}

export interface UndeployResult {
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
 * heroUndeploy({ state, action })
 *
 * Pure function — returns a new roster with the target hero marked onMap:false.
 * No I/O; the route handler persists via the repository after calling this.
 */
export function heroUndeploy({
  state,
  action,
}: {
  state:  UndeployState;
  action: UndeployAction;
}): UndeployResult {
  const { heroes, wallet } = state;
  const { heroId } = action;

  const hero = heroes.find((h) => h.id === heroId);

  if (!hero) {
    return { ok: false, error: "Hero not found", code: "HERO_NOT_FOUND" };
  }
  if (hero.owner !== wallet) {
    return { ok: false, error: "Hero does not belong to this wallet", code: "NOT_OWNER" };
  }
  if (!hero.onMap) {
    return { ok: false, error: "Hero is not deployed", code: "NOT_DEPLOYED" };
  }

  const updated: RosterHero = { ...hero, onMap: false };
  const roster = heroes.map((h) => (h.id === heroId ? updated : h));

  return { ok: true, hero: updated, roster };
}

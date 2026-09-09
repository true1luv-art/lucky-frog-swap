/**
 * features/events/bomb-detonate/action.ts
 *
 * Pure event function — no DB, no side effects.
 *
 * Models a single BOMB DETONATION, which is the real atomic unit of play:
 *   - one detonation costs exactly 1 energy (matches the client, which
 *     consumes 1 energy per bomb via consumeBombEnergy)
 *   - the blast deals `hero.power` HP to EVERY destructible node it touches
 *     (matches ExplosionManager.detonate, which passes b.damage = hero.power)
 *
 * This replaces the old per-hit model where the server subtracted 1 HP and
 * charged 1 energy per node. That model could never represent a multi-tile,
 * multi-HP blast, so multi-HP chests were never destroyed server-side and the
 * next canonical push "resurrected" tiles the client had already cleared.
 *
 * Rate limiting is per-hero (not global) so concurrent heroes never reject
 * one another — the old global 800 ms window rejected normal multi-hero play.
 */

import type { MineState, HeroEnergyState } from "@/features/mine-action/types";
import { mineDestroy } from "@/features/events/mine-destroy/action";

/** Minimum ms between two accepted detonations FROM THE SAME HERO. */
export const MIN_DETONATE_INTERVAL_MS = 120;

export interface BombDetonateAction {
  type:     "bomb.detonate";
  heroId:   string;
  /** "x,y" keys of every destructible node the blast touched. */
  nodeKeys: string[];
}

export interface DetonateResult {
  ok:            boolean;
  error?:        string;
  code?:         string;
  /** Mutated state — only meaningful when ok === true. */
  newState?:     MineState;
  /** Total coins earned across every node destroyed by this blast. */
  coinsEarned:   number;
  /** "x,y" keys destroyed by this blast (hp reached 0). */
  destroyedKeys: string[];
  /** Hero energy remaining after the detonation. */
  heroEnergy:    number;
  stageComplete: boolean;
}

export function bombDetonate({
  state,
  action,
  createdAt = Date.now(),
}: {
  state:      MineState;
  action:     BombDetonateAction;
  createdAt?: number;
}): DetonateResult {
  const fail = (error: string, code: string): DetonateResult => ({
    ok: false, error, code, coinsEarned: 0, destroyedKeys: [], heroEnergy: 0, stageComplete: false,
  });

  const { heroId, nodeKeys } = action;

  // --- Hero must be deployed ---
  const hero = state.heroes[heroId];
  if (!hero) {
    return fail("Hero is not on the map", "HERO_NOT_ON_MAP");
  }

  // --- Per-hero flood guard (not global — concurrent heroes must not block) ---
  if (hero.lastActionAt > 0 && createdAt - hero.lastActionAt < MIN_DETONATE_INTERVAL_MS) {
    return fail("Detonations from a hero must be spaced out", "DETONATE_TOO_FAST");
  }

  // --- Hero must have energy for this bomb (1 energy per detonation) ---
  if (hero.currentEnergy < 1) {
    return fail("Hero has no energy", "INSUFFICIENT_ENERGY");
  }

  const power = Math.max(1, hero.power);

  // Apply `power` damage to every distinct destructible node in the blast.
  const nextNodes = { ...state.nodes };
  const destroyedKeys: string[] = [];
  let coinsEarned = 0;
  let newlyDestroyed = 0;

  const seen = new Set<string>();
  for (const nodeKey of nodeKeys) {
    if (seen.has(nodeKey)) continue;
    seen.add(nodeKey);

    const node = nextNodes[nodeKey];
    // Skip missing / already-destroyed nodes silently — the blast still counts
    // as a valid detonation; those tiles simply take no further damage.
    if (!node || node.destroyed) continue;

    const newHp = Math.max(0, node.hp - power);
    const destroyed = newHp === 0;

    if (destroyed) {
      const destroyAction =
        node.kind === "chest"
          ? ({ type: "chest.destroyed", nodeKey } as const)
          : ({ type: "bush.destroyed",  nodeKey } as const);
      coinsEarned += mineDestroy({ node, action: destroyAction }).coinsEarned;
      destroyedKeys.push(nodeKey);
      newlyDestroyed += 1;
    }

    nextNodes[nodeKey] = { ...node, hp: newHp, destroyed };
  }

  // One detonation = one bomb = exactly 1 energy, regardless of tiles hit.
  const nextHero: HeroEnergyState = {
    ...hero,
    currentEnergy: Math.max(0, hero.currentEnergy - 1),
    lastActionAt:  createdAt,
  };

  const newState: MineState = {
    ...state,
    coins:          state.coins + coinsEarned,
    lastActionAt:   createdAt,
    destroyedNodes: state.destroyedNodes + newlyDestroyed,
    heroes: {
      ...state.heroes,
      [heroId]: nextHero,
    },
    nodes: nextNodes,
  };

  const stageComplete = newState.destroyedNodes >= newState.totalNodes;

  return {
    ok: true,
    newState,
    coinsEarned,
    destroyedKeys,
    heroEnergy: nextHero.currentEnergy,
    stageComplete,
  };
}

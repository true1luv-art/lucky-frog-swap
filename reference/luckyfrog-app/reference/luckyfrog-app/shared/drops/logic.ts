import seedrandom from "seedrandom";
import {
  MAX_CHARM,
  CHARM_CRIT_TABLE,
  STASH_LUCK_TABLE,
  STASH_DODGE_TABLE,
  MAX_STASH,
} from "@/shared/data/stats";

export interface FrogmentDrop {
  kind: "frogment";
  amount: number;
  crit: boolean;
}

export type DropResult = FrogmentDrop;

function lookupSteppedBonus(table: [number, number][], amount: number): number {
  let result = 0;
  for (const [minAmount, value] of table) {
    if (amount >= minAmount) result = value;
    else break;
  }
  return result;
}

/** Compute the crit bonus percentage from burned charm. */
export function computeCritFromCharm(charm: number): number {
  const clamped = Math.min(Math.max(charm, 0), MAX_CHARM);
  return lookupSteppedBonus(CHARM_CRIT_TABLE, clamped);
}

/** Compute permanent luck and dodge bonuses from cumulative stash. */
export function computeStashBonus(stash: number): { luck: number; dodge: number } {
  const clamped = Math.min(Math.max(stash, 0), MAX_STASH);
  return {
    luck: lookupSteppedBonus(STASH_LUCK_TABLE, clamped),
    dodge: lookupSteppedBonus(STASH_DODGE_TABLE, clamped),
  };
}

/** Roll a Frogment amount. Luck raises the maximum possible amount. */
export function computeFrogmentDrop(luckMod: number, seed: string): { amount: number } {
  const rng = seedrandom(`${seed}:frogment-amount`);
  const luckFactor = Math.min(Math.max(luckMod, 0), 100) / 100;
  const maximum = 50 + Math.round(luckFactor * 50);
  const amount = Math.floor((1 + rng() * (maximum - 1)) * 100) / 100;
  return { amount };
}

/** Roll a deterministic Frogment reward with optional crit doubling. */
export function rollDrop(
  totalLuck: number,
  totalCrit: number,
  seed: string,
): DropResult {
  const { amount } = computeFrogmentDrop(totalLuck, seed);
  const isCrit = seedrandom(`${seed}:crit`)() * 100 < totalCrit;
  return {
    kind: "frogment",
    amount: isCrit ? amount * 2 : amount,
    crit: isCrit,
  };
}

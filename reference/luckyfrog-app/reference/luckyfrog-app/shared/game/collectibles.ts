import { COLLECTIBLES, isCollectibleName } from "@/shared/data/collectibles";
import { COLLECTIBLE_NAMES, type CollectibleName } from "@/shared/types/gameplay/collectibles";
import { computeBonus } from "@/shared/game/skills";
import type { PlayerSkills, SkillBonus } from "@/shared/types/gameplay/skills";

export function normalizeOwnedCollectibles(
  ownedNames: Iterable<string>,
): CollectibleName[] {
  const owned = new Set(Array.from(ownedNames).filter(isCollectibleName));
  return COLLECTIBLE_NAMES.filter((name) => owned.has(name));
}

export function ownsCollectible(
  ownedNames: Iterable<string>,
  name: CollectibleName,
): boolean {
  return new Set(ownedNames).has(name);
}

export function getCollectibleBonuses(
  ownedNames: Iterable<string>,
): Partial<SkillBonus> {
  const bonuses: Partial<SkillBonus> = {};

  for (const name of normalizeOwnedCollectibles(ownedNames)) {
    const { bonusKey, amount } = COLLECTIBLES[name].effect;
    bonuses[bonusKey] = amount;
  }

  return bonuses;
}

export function recomputeOwnedBonuses(
  skills: Readonly<PlayerSkills>,
  ownedNames: Iterable<string>,
): SkillBonus {
  return mergeSkillAndCollectibleBonuses(
    computeBonus(skills),
    getCollectibleBonuses(ownedNames),
  );
}

export function mergeSkillAndCollectibleBonuses(
  skillBonus: Readonly<SkillBonus>,
  collectibleBonus: Readonly<Partial<SkillBonus>>,
): SkillBonus {
  const merged = { ...skillBonus };

  for (const [key, amount] of Object.entries(collectibleBonus) as [keyof SkillBonus, number][]) {
    merged[key] += amount;
  }

  return merged;
}

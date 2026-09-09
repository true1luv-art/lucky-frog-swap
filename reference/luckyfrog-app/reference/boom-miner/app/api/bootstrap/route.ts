import { apiOk, apiError } from "@/lib/api/error-response";
import { getWallet } from "@/lib/api/get-wallet";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { getHeroesByWallet } from "@/lib/modules/heroes/repository.server";
import { getOrCreateStageMap } from "@/lib/modules/stage-maps/repository.server";
import { HERO_RARITY_DEFS, type HeroRarity } from "@/features/types/HeroRarity";

/**
 * GET /api/bootstrap
 *
 * Single round-trip that returns everything the game needs on boot:
 *   { player, heroes, stageMap }
 *
 * The client should call this once after login and populate the store via
 * gameStore.hydrate(payload).
 */
export async function GET(req: Request): Promise<Response> {
  const wallet = await getWallet(req);
  if (!wallet) {
    return apiError("Not authenticated", "UNAUTHORIZED", 401);
  }

  const player = await findPlayerByWallet(wallet);
  if (!player) {
    return apiError("Player not found. Register first.", "PLAYER_NOT_FOUND", 404);
  }

  // Run all three data fetches in parallel — they share the same DB connection.
  const [heroes, stageMapDoc] = await Promise.all([
    getHeroesByWallet(wallet),
    getOrCreateStageMap(wallet),
  ]);

  // Serialize the nodes map to a plain object.
  // Explicitly spread each node to ensure `destroyed` is always present as a
  // boolean (guards against BSON Map deserialization oddities with lean()).
  const nodesObj: Record<string, unknown> = {};
  const rawNodes = stageMapDoc.nodes as unknown as Map<string, { destroyed?: boolean; [k: string]: unknown }> | Record<string, { destroyed?: boolean; [k: string]: unknown }>;
  if (rawNodes instanceof Map) {
    rawNodes.forEach((v, k) => { nodesObj[k] = { ...v, destroyed: v.destroyed ?? false }; });
  } else {
    for (const [k, v] of Object.entries(rawNodes)) {
      nodesObj[k] = { ...v, destroyed: v.destroyed ?? false };
    }
  }

  // Serialize IHero lean docs into the RosterHero-compatible shape the client expects.
  // ENERGY_PER_STAMINA = 100 (matches store constant).
  const ENERGY_PER_STAMINA = 100;
  const serializedHeroes = heroes.map((h) => {
    const maxE = h.maxEnergy ?? h.attributes.stamina * ENERGY_PER_STAMINA;
    return {
      id:            String(h._id),
      name:          h.name,
      minted_number: h.minted_number,
      description:   "",
      image:         null,
      owner:         h.ownerWallet,
      level:         h.level,
      rarity:        h.rarity ?? null,
      attributes: {
        power:        h.attributes.power,
        speed:        h.attributes.speed,
        stamina:      h.attributes.stamina,
        bomb_number:  h.attributes.bombNumber,
        bomb_range:   h.attributes.bombRange,
      },
      market: {
        listed:  h.market?.listed  ?? false,
        price:   h.market?.price   ?? 0,
        seller:  h.market?.seller  ?? null,
        created: h.market?.created ?? 0,
        sold:    h.market?.sold    ?? 0,
      },
      type:          h.type,
      rarityLabel:   HERO_RARITY_DEFS[h.rarity as HeroRarity]?.label ?? h.rarity,
      currentEnergy: h.currentEnergy,
      maxEnergy:     maxE,
      onMap:         h.onMap,
    };
  });

  return apiOk({
    player: {
      wallet:   player.wallet,
      username: player.username ?? null,
      coins:    player.coins,
      stage:    player.stage,
    },
    heroes: serializedHeroes,
    stageMap: {
      stage:         stageMapDoc.stage,
      seed:          stageMapDoc.seed,
      width:         stageMapDoc.width,
      height:        stageMapDoc.height,
      nodes:         nodesObj,
      totalChests:   stageMapDoc.totalChests,
      clearedChests: stageMapDoc.clearedChests,
    },
  });
}

/**
 * features/mine-action/build-state.ts
 *
 * Reads from DB and reconstructs the full MineState the server needs to
 * validate a hit independently of what the client claims.
 *
 * Pattern: robinhood-farm/features/farm-action/build-state.ts
 */

import { connectDatabase } from "@/lib/config/database";
import { StageMapModel } from "@/lib/modules/stage-maps/model.server";
import { HeroModel } from "@/lib/modules/heroes/model.server";
import { PlayerModel } from "@/lib/modules/players/model.server";
import type { IStageMap, MapNode } from "@/lib/modules/stage-maps/types.server";
import type { IHero } from "@/lib/modules/heroes/types.server";
import type { MineState, MapNodeSnapshot, HeroEnergyState } from "./types";

export async function buildMineState(wallet: string): Promise<MineState | null> {
  await connectDatabase();

  // Fetch all three collections in parallel.
  const [mapDoc, heroes, player] = await Promise.all([
    StageMapModel.findOne({ playerId: wallet }).lean<IStageMap>(),
    HeroModel.find({ ownerWallet: wallet, onMap: true }).lean<IHero[]>(),
    PlayerModel.findOne({ wallet }, { coins: 1, stage: 1 }).lean<{ coins: number; stage: number; updatedAt?: Date }>(),
  ]);

  if (!mapDoc || !player) return null;

  // Normalise the nodes Map/Object into a plain Record<"x,y", MapNodeSnapshot>.
  const rawNodes = mapDoc.nodes as unknown as Map<string, MapNode> | Record<string, MapNode>;
  const nodesRecord: Record<string, MapNodeSnapshot> = {};

  const toSnapshot = (k: string, v: MapNode) => {
    nodesRecord[k] = {
      kind:       v.kind,
      rarity:     v.rarity,
      hp:         v.hp,
      maxHp:      v.maxHp,
      coinReward: v.coins ?? 0,
      destroyed:  v.destroyed,
      x:          v.x,
      y:          v.y,
    };
  };

  if (rawNodes instanceof Map) {
    // Map.forEach signature: (value, key) — note reversed order vs Object.entries.
    rawNodes.forEach((v, k) => toSnapshot(k, v));
  } else {
    Object.entries(rawNodes).forEach(([k, v]) => toSnapshot(k, v));
  }

  // Build hero energy map — only deployed (onMap) heroes can hit.
  const heroMap: Record<string, HeroEnergyState> = {};
  for (const h of heroes) {
    heroMap[String(h._id)] = {
      _id:           String(h._id),
      currentEnergy: h.currentEnergy,
      maxEnergy:     h.maxEnergy,
      power:         Math.max(1, h.attributes?.power ?? 1),
      lastActionAt:  0,
    };
  }

  const totalNodes     = Object.keys(nodesRecord).length;
  const destroyedNodes = Object.values(nodesRecord).filter((n) => n.destroyed).length;

  return {
    wallet,
    coins:          player.coins,
    stage:          player.stage,
    nodes:          nodesRecord,
    totalNodes,
    destroyedNodes,
    heroes:         heroMap,
    // Phase G: explicit DB field — replaces the fragile updatedAt proxy.
    // Falls back to 0 for documents predating this change.
    lastActionAt: mapDoc.lastActionAt ?? 0,
    // Phase G: read the monotonic version from the DB (written by FlushScheduler).
    // Falls back to 0 for documents predating this change.
    mapVersion: mapDoc.mapVersion ?? 0,
  };
}

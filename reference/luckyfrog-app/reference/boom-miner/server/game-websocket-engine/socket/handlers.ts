/**
 * server/game-websocket-engine/socket/handlers.ts
 *
 * Registers all Socket.IO event handlers for one connected socket.
 * Called once per connection from index.ts after auth middleware passes.
 *
 * Responsibilities:
 *  - Load session state from DB on connect (or resume from SessionBackfill).
 *  - Validate and apply mine:hit events in real time (optimistic, no DB write).
 *  - Increment mapVersion per-hit and mark session dirty.
 *  - On stage complete: flush immediately, rebuild from DB, push new map.
 *  - Handle session:sync, session:complete, and disconnect (Phase E).
 */

import type { Socket, Server } from "socket.io";
import type { SessionStore } from "../session/SessionStore";
import type { FlushScheduler } from "../session/FlushScheduler";
import { WS_EVENTS } from "./events";
import type {
  MineHitPayload,
  MineHitAckPayload,
  MineHitRejectPayload,
  HeroUndeployPayload,
  BombDetonatePayload,
  BombDetonateAckPayload,
  BombDetonateRejectPayload,
  HeroDeployPayload,
  HeroDeployAckPayload,
  HeroDeployRejectPayload,
  PlayerStatePayload,
} from "./events";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { buildMineState } from "@/features/mine-action/build-state";
import { persistChestDestroy } from "@/features/mine-action/persist";
import { mineHit } from "@/features/events/mine-hit/action";
import { bombDetonate } from "@/features/events/bomb-detonate/action";
import { heroDeploy } from "@/features/events/hero-deploy/action";
import { heroUndeploy } from "@/features/events/hero-undeploy/action";
import { getHeroesByWallet, setHeroOnMap, catchUpOfflineRegen } from "@/lib/modules/heroes/repository.server";
import type { IHero } from "@/lib/modules/heroes/types.server";
import type { RosterHero } from "@/features/store/gameStore";
import { HERO_RARITY_DEFS, type HeroRarity } from "@/features/types/HeroRarity";
import type { MineState, HeroEnergyState } from "@/features/mine-action/types";
import type { SyncLogResponse } from "@/features/types/sync";

/**
 * How long a disconnected player's room is kept in memory before eviction.
 * During this window a reconnect resumes the exact live state with no DB read.
 * After it, the room is dropped and a later reconnect rebuilds from the
 * already-flushed stage_maps fallback (same map).
 */
const ROOM_RETENTION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Maps the server-internal MineState shape to the SyncLogResponse["canonicalState"]
 * shape expected by the client's MapManager.applyServerState().
 * Key difference: MineState nodes use `coinReward`, canonicalState expects `coins`.
 */
function toCanonicalState(s: MineState): SyncLogResponse["canonicalState"] {
  const nodes: SyncLogResponse["canonicalState"]["nodes"] = {};
  for (const [key, n] of Object.entries(s.nodes)) {
    nodes[key] = {
      x:         n.x,
      y:         n.y,
      kind:      n.kind,
      rarity:    n.rarity,
      maxHp:     n.maxHp,
      hp:        n.hp,
      coins:     n.coinReward,
      destroyed: n.destroyed,
    };
  }
  const heroes: SyncLogResponse["canonicalState"]["heroes"] = {};
  for (const [id, h] of Object.entries(s.heroes)) {
    heroes[id] = { currentEnergy: h.currentEnergy, maxEnergy: h.maxEnergy };
  }
  return {
    nodes,
    heroes,
    coins:          s.coins,
    stage:          s.stage,
    totalNodes:     s.totalNodes,
    destroyedNodes: s.destroyedNodes,
  };
}

/**
 * Maps a lean IHero doc into the RosterHero shape the pure heroDeploy /
 * heroUndeploy event functions expect. Only the fields those functions read
 * (id, owner, onMap, currentEnergy) truly matter, but we build the full shape
 * so the types line up with the shared event contracts.
 */
function toRosterHero(h: IHero): RosterHero {
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
      power:       h.attributes.power,
      speed:       h.attributes.speed,
      stamina:     h.attributes.stamina,
      bomb_number: h.attributes.bombNumber,
      bomb_range:  h.attributes.bombRange,
    },
    market: {
      listed:  h.market.listed,
      price:   h.market.price,
      seller:  h.market.seller,
      created: h.market.created,
      sold:    h.market.sold,
    },
    type:          h.type,
    rarityLabel:   HERO_RARITY_DEFS[h.rarity as HeroRarity]?.label ?? h.rarity,
    currentEnergy: h.currentEnergy,
    maxEnergy:     h.maxEnergy,
    onMap:         h.onMap,
  };
}

export async function registerHandlers(
  socket:    Socket,
  io:        Server,
  store:     SessionStore,
  flusher:   FlushScheduler,
): Promise<void> {
  const wallet = socket.data.wallet as string;

  // ------------------------------------------------------------------
  // 1. Load session state on connect from stage_maps (canonical source of truth).
  //    The VPS process is persistent; in-memory SessionStore covers the
  //    30-second window between flushes, so no WAL/backfill is needed.
  // ------------------------------------------------------------------
  const dbState = await buildMineState(wallet);

  if (!dbState) {
    socket.emit(WS_EVENTS.SESSION_ERROR, { message: "MAP_NOT_FOUND" });
    socket.disconnect(true);
    return;
  }

  const resolvedState = dbState;

  let initialState = resolvedState;

  // Resume-or-replace: reuse any retained room for this wallet.
  //  - Reconnect after a network drop: the old socket is already gone, the room
  //    was retained in memory, and we resume from its live state (DB untouched).
  //  - Second browser tab: the old socket is still live, so we kick it first to
  //    prevent duplicate energy consumption and split SessionStore entries.
  // Either way the in-memory room is the source of truth; DB is only a fallback
  // for when no room exists (see buildMineState above).
  const existing = store.get(wallet);
  if (existing && existing.socketId !== socket.id) {
    // Cancel any pending grace-period eviction — the player is back.
    if (existing.evictTimer) {
      clearTimeout(existing.evictTimer);
      existing.evictTimer = undefined;
    }
    existing.disconnected = false;

    const oldSocket = io.sockets.sockets.get(existing.socketId);
    if (oldSocket) {
      oldSocket.emit(WS_EVENTS.SESSION_ERROR, { message: "REPLACED_BY_NEW_TAB" });
      oldSocket.disconnect(true);
    }
    // Flush pending dirty state from the evicted session before dropping it.
    if (existing.dirty) {
      await flusher.flushOne(existing).catch((err) =>
        console.error(`[handlers] pre-eviction flush failed for ${wallet}:`, err),
      );
    }
    // The evicted session's in-memory state is newer than what we read from DB.
    // Use it directly so the new tab picks up the unhushed hits.
    initialState = existing.stageAdvanced
      ? (await buildMineState(wallet)) ?? existing.state
      : structuredClone(existing.state);
    store.delete(wallet);
    console.log(`[handlers] wallet ${wallet} — evicted previous tab (socketId: ${existing.socketId})`);
  }

  store.set(wallet, {
    wallet,
    state:            initialState,
    dirty:            false,
    revision:         0,
    flushPromise:     null,
    socketId:         socket.id,
    connectedAt:      Date.now(),
    lastActionAt:     initialState.lastActionAt ?? 0,
    lastFlushedState: null,
    lastRegenAt:      Date.now(),
  });

  // Apply offline regen catch-up for resting heroes before pushing state.
  // The RegenScheduler only ticks while a session is live; heroes that were
  // depleted before the player logged out need their energy topped up by
  // however much time has elapsed since the last regen write (lastRegenAt).
  // We await this so the very first SESSION_STATE push has correct energy.
  await catchUpOfflineRegen(wallet).catch((err) =>
    console.error(`[handlers] catchUpOfflineRegen failed for ${wallet}:`, err),
  );

  // Push canonical state to client immediately on connect.
  // Resting hero energies are served by the bootstrap HTTP route (which reads
  // directly from DB), so they already reflect the just-applied catch-up regen.
  // Only on-map heroes live in initialState.heroes, so no patch is needed here.
  // Shape as SyncLogResponse["canonicalState"] so the client's MapManager
  // applyServerState() receives the expected field names (coins, not coinReward).
  socket.emit(WS_EVENTS.SESSION_STATE, { canonicalState: toCanonicalState(initialState) });

  // ------------------------------------------------------------------
  // 2. mine:hit — validate and apply a single bomb hit.
  // ------------------------------------------------------------------
  socket.on(WS_EVENTS.MINE_HIT, async (payload: MineHitPayload) => {
    const entry = store.get(wallet);
    if (!entry) {
      const reject: MineHitRejectPayload = { seq: payload.seq, code: "SESSION_GONE", reason: "Session not found" };
      socket.emit(WS_EVENTS.MINE_HIT_REJECT, reject);
      return;
    }

    let shouldAdvanceStage = false;
    const previousOperation = entry.flushPromise ?? Promise.resolve();
    const mutation = previousOperation.catch(() => undefined).then(async () => {
      if (store.get(wallet) !== entry) return;

      const now = Date.now();
      const result = mineHit({
        state: entry.state,
        action: { type: "node.hit", heroId: payload.heroId, nodeKey: payload.nodeKey },
        createdAt: now,
      });

      if (!result.ok) {
        const reject: MineHitRejectPayload = {
          seq: payload.seq,
          code: result.code ?? "REJECTED",
          reason: result.error ?? "Hit rejected",
        };
        socket.emit(WS_EVENTS.MINE_HIT_REJECT, reject);
        return;
      }

      const nextState: MineState = {
        ...result.newState!,
        mapVersion: entry.state.mapVersion + 1,
        lastActionAt: now,
      };

      entry.state = nextState;
      entry.revision += 1;
      entry.dirty = true;
      entry.lastActionAt = now;
      shouldAdvanceStage = result.stageComplete;

      const ack: MineHitAckPayload = {
        seq: payload.seq,
        coinsEarned: result.coinsEarned,
        destroyed: result.destroyed,
        stageComplete: result.stageComplete,
        nodeHp: nextState.nodes[payload.nodeKey]?.hp ?? 0,
        eventType: result.eventType,
      };
      socket.emit(WS_EVENTS.MINE_HIT_ACK, ack);

      const heroAfterHit = nextState.heroes[payload.heroId];
      if (heroAfterHit && heroAfterHit.currentEnergy <= 0) {
        const undeploy: HeroUndeployPayload = { heroId: payload.heroId };
        socket.emit(WS_EVENTS.HERO_UNDEPLOY, undeploy);
      }
    });

    entry.flushPromise = mutation;
    try {
      await mutation;
    } finally {
      if (entry.flushPromise === mutation) entry.flushPromise = null;
    }

    if (shouldAdvanceStage) {
      await flusher.flushOne(entry);
      if (entry.stageAdvanced && entry.lastFlushedState) {
        entry.stageAdvanced = false;
        entry.state = structuredClone(entry.lastFlushedState);
        entry.dirty = false;
        socket.emit(WS_EVENTS.SESSION_STATE, { canonicalState: toCanonicalState(entry.state) });
      }
    }
  });

  // ------------------------------------------------------------------
  // 2b. bomb:detonate — validate and apply a whole bomb blast.
  //     One detonation = 1 energy + `power` damage to every node hit.
  //     This is the canonical unit of play; mine:hit is kept for compat.
  // ------------------------------------------------------------------
  socket.on(WS_EVENTS.BOMB_DETONATE, async (payload: BombDetonatePayload) => {
    const entry = store.get(wallet);
    if (!entry) {
      const reject: BombDetonateRejectPayload = { seq: payload.seq, code: "SESSION_GONE", reason: "Session not found" };
      socket.emit(WS_EVENTS.BOMB_DETONATE_REJECT, reject);
      return;
    }

    let shouldAdvanceStage = false;
    const previousOperation = entry.flushPromise ?? Promise.resolve();
    const mutation = previousOperation.catch(() => undefined).then(async () => {
      if (store.get(wallet) !== entry) return;

      const now = Date.now();
      // Snapshot prevState before mutation — needed as the CAS baseline for
      // the immediate chest-destroy flush below.
      const prevState = structuredClone(entry.state);

      const result = bombDetonate({
        state: entry.state,
        action: { type: "bomb.detonate", heroId: payload.heroId, nodeKeys: payload.nodeKeys },
        createdAt: now,
      });

      if (!result.ok) {
        const reject: BombDetonateRejectPayload = {
          seq: payload.seq,
          code: result.code ?? "REJECTED",
          reason: result.error ?? "Detonation rejected",
        };
        socket.emit(WS_EVENTS.BOMB_DETONATE_REJECT, reject);
        return;
      }

      const nextState: MineState = {
        ...result.newState!,
        mapVersion: entry.state.mapVersion + 1,
        lastActionAt: now,
      };

      entry.state = nextState;
      entry.revision += 1;
      entry.dirty = true;
      entry.lastActionAt = now;
      shouldAdvanceStage = result.stageComplete;

      const ack: BombDetonateAckPayload = {
        seq: payload.seq,
        coinsTotal: nextState.coins,
        stage: nextState.stage,
        heroId: payload.heroId,
        heroEnergy: result.heroEnergy,
        destroyedKeys: result.destroyedKeys,
        stageComplete: result.stageComplete,
      };
      socket.emit(WS_EVENTS.BOMB_DETONATE_ACK, ack);

      if (result.heroEnergy <= 0) {
        const undeploy: HeroUndeployPayload = { heroId: payload.heroId };
        socket.emit(WS_EVENTS.HERO_UNDEPLOY, undeploy);
      }

      // Immediately persist when chests were destroyed so coins and map state
      // reach the DB before the player can refresh. This runs fire-and-forget
      // (does not block the ACK) but updates lastFlushedState on success so the
      // periodic FlushScheduler uses the correct baseline and avoids conflicts.
      const chestDestroyed = result.destroyedKeys.some(
        (k) => nextState.nodes[k]?.kind === "chest",
      );
      if (chestDestroyed && !result.stageComplete) {
        const snapNext = structuredClone(nextState);
        persistChestDestroy({ prevState, nextState: snapNext })
          .then((r) => {
            if (r.status === "ok") {
              // Update the baseline so the next FlushScheduler diff is correct.
              const liveEntry = store.get(wallet);
              if (liveEntry) liveEntry.lastFlushedState = snapNext;
            } else {
              // Conflict or error — leave dirty=true so the FlushScheduler
              // retries on the next cycle via its conflict-retry path.
              console.warn(`[handlers] chest-destroy flush ${r.status} for ${wallet} — FlushScheduler will retry`);
            }
          })
          .catch((err) =>
            console.error(`[handlers] chest-destroy flush threw for ${wallet}:`, err),
          );
      }
    });

    entry.flushPromise = mutation;
    try {
      await mutation;
    } finally {
      if (entry.flushPromise === mutation) entry.flushPromise = null;
    }

    if (shouldAdvanceStage) {
      await flusher.flushOne(entry);
      if (entry.stageAdvanced && entry.lastFlushedState) {
        entry.stageAdvanced = false;
        entry.state = structuredClone(entry.lastFlushedState);
        entry.dirty = false;
        socket.emit(WS_EVENTS.SESSION_STATE, { canonicalState: toCanonicalState(entry.state) });
      }
    }
  });

  // ------------------------------------------------------------------
  // 2c. hero:deploy — deploy (onMap:true) or recall (onMap:false) a hero.
  //     Validates against the live DB roster, persists onMap, and mutates the
  //     in-memory room so the deployed hero immediately starts/stops mining
  //     and burning energy. The room is the source of truth; DB is the flush
  //     target + fallback.
  // ------------------------------------------------------------------
  socket.on(WS_EVENTS.HERO_DEPLOY, async (payload: HeroDeployPayload) => {
    const entry = store.get(wallet);
    if (!entry) {
      const reject: HeroDeployRejectPayload = {
        seq: payload.seq, heroId: payload.heroId, onMap: payload.onMap,
        code: "SESSION_GONE", reason: "Session not found",
      };
      socket.emit(WS_EVENTS.HERO_DEPLOY_REJECT, reject);
      return;
    }

    // Serialize behind any in-flight mutation so the roster read and the
    // energy accounting can't interleave with a concurrent detonation.
    const previousOperation = entry.flushPromise ?? Promise.resolve();
    const mutation = previousOperation.catch(() => undefined).then(async () => {
      if (store.get(wallet) !== entry) return;

      // Pure validation against the current DB roster.
      const dbHeroes = await getHeroesByWallet(wallet);
      const roster = dbHeroes.map(toRosterHero);
      const eventResult = payload.onMap
        ? heroDeploy({ state: { wallet, heroes: roster }, action: { heroId: payload.heroId } })
        : heroUndeploy({ state: { wallet, heroes: roster }, action: { heroId: payload.heroId } });

      if (!eventResult.ok) {
        const reject: HeroDeployRejectPayload = {
          seq: payload.seq, heroId: payload.heroId, onMap: payload.onMap,
          code: eventResult.code ?? "DEPLOY_REJECTED", reason: eventResult.error ?? "Deploy rejected",
        };
        socket.emit(WS_EVENTS.HERO_DEPLOY_REJECT, reject);
        return;
      }

      // Persist the validated change (repository re-checks energy + MAX_ON_MAP).
      const hero = await setHeroOnMap(wallet, payload.heroId, payload.onMap);
      if (!hero) {
        const reject: HeroDeployRejectPayload = {
          seq: payload.seq, heroId: payload.heroId, onMap: payload.onMap,
          code: "STALE_STATE", reason: "Deploy state changed — please retry",
        };
        socket.emit(WS_EVENTS.HERO_DEPLOY_REJECT, reject);
        return;
      }

      // Reflect the change in the live room so the hero starts/stops burning
      // energy on subsequent detonations.
      const heroId = String(hero._id);
      if (payload.onMap) {
        const energyState: HeroEnergyState = {
          _id:           heroId,
          currentEnergy: hero.currentEnergy,
          maxEnergy:     hero.maxEnergy,
          power:         Math.max(1, hero.attributes?.power ?? 1),
          lastActionAt:  0,
        };
        entry.state = { ...entry.state, heroes: { ...entry.state.heroes, [heroId]: energyState } };
      } else {
        const nextHeroes = { ...entry.state.heroes };
        delete nextHeroes[heroId];
        entry.state = { ...entry.state, heroes: nextHeroes };
      }

      const ack: HeroDeployAckPayload = {
        seq: payload.seq, heroId, onMap: hero.onMap, currentEnergy: hero.currentEnergy,
      };
      socket.emit(WS_EVENTS.HERO_DEPLOY_ACK, ack);
    });

    entry.flushPromise = mutation;
    try {
      await mutation;
    } finally {
      if (entry.flushPromise === mutation) entry.flushPromise = null;
    }
  });

  // ------------------------------------------------------------------
  // 3. session:sync — push current canonical state on demand.
  // ------------------------------------------------------------------
  socket.on(WS_EVENTS.SESSION_SYNC, () => {
    const entry = store.get(wallet);
    if (!entry) return;
    socket.emit(WS_EVENTS.SESSION_STATE, { canonicalState: toCanonicalState(entry.state) });
  });

  // ------------------------------------------------------------------
  // 3b. player:sync — authoritative off-map economy + roster push.
  //     Read-only: never mutates the in-memory mine session. The client fires
  //     this after its poller detects a settled mint/withdrawal, and we reply
  //     with fresh coins + stage + roster straight from the DB so balance and
  //     hero list can't drift from server truth.
  // ------------------------------------------------------------------
  socket.on(WS_EVENTS.PLAYER_SYNC, async () => {
    try {
      const [player, dbHeroes] = await Promise.all([
        findPlayerByWallet(wallet),
        getHeroesByWallet(wallet),
      ]);
      const payload: PlayerStatePayload = {
        coins:  (player as { coins?: number } | null)?.coins ?? 0,
        stage:  (player as { stage?: number } | null)?.stage ?? 1,
        heroes: dbHeroes.map(toRosterHero),
      };
      socket.emit(WS_EVENTS.PLAYER_STATE, payload);
    } catch (err) {
      console.error(`[handlers] player:sync failed for ${wallet}:`, err);
    }
  });

  // ------------------------------------------------------------------
  // 4. session:complete — stage cleared, flush immediately.
  // ------------------------------------------------------------------
  socket.on(WS_EVENTS.SESSION_COMPLETE, async () => {
    const entry = store.get(wallet);
    if (!entry) return;
    try {
      await flusher.flushOne(entry);
      console.log(`[handlers] wallet ${wallet} session:complete — immediate flush done`);
    } catch (err) {
      console.error(`[handlers] session:complete flush failed for ${wallet}:`, err);
    }
  });

  // ------------------------------------------------------------------
  // 5. disconnect — flush dirty state, then RETAIN the room so the player
  //    can reconnect into the exact same live map. The room (and its live
  //    MineState) stays in memory as the source of truth; the stage_maps DB
  //    doc is only a fallback. To avoid an unbounded memory leak for players
  //    who never return, the room is evicted after a grace period — by then
  //    the disconnect flush has already persisted the identical map to DB, so
  //    a later reconnect rebuilds the same state from the fallback.
  // ------------------------------------------------------------------
  socket.on("disconnect", async (reason: string) => {
    console.log(`[handlers] wallet ${wallet} disconnected (${reason})`);
    const entry = store.get(wallet);
    if (entry && entry.dirty) {
      try {
        await flusher.flushOne(entry);
      } catch (err) {
        console.error(`[handlers] disconnect flush failed for ${wallet}:`, err);
      }
    }

    // Only arm retention if this socket is still the active one (a reconnect or
    // new tab may have already replaced the room with a fresh entry).
    const current = store.get(wallet);
    if (!current || current.socketId !== socket.id) return;

    current.disconnected = true;
    if (current.evictTimer) clearTimeout(current.evictTimer);
    current.evictTimer = setTimeout(() => {
      const still = store.get(wallet);
      // Evict only if the room is still this disconnected socket's — a reconnect
      // would have swapped in a new socketId and cleared this timer.
      if (still && still.socketId === socket.id && still.disconnected) {
        store.delete(wallet);
        console.log(`[handlers] wallet ${wallet} room evicted after ${ROOM_RETENTION_MS}ms grace period`);
      }
    }, ROOM_RETENTION_MS);
    console.log(`[handlers] wallet ${wallet} room retained for reconnect (${ROOM_RETENTION_MS}ms grace)`);
  });
}

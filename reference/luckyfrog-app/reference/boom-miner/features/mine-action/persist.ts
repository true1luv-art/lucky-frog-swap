import mongoose, { type ClientSession } from "mongoose";
import { connectDatabase } from "@/lib/config/database";
import { StageMapModel } from "@/lib/modules/stage-maps/model.server";
import { HeroModel } from "@/lib/modules/heroes/model.server";
import { PlayerModel } from "@/lib/modules/players/model.server";
import { generateStageMap, rollSeed } from "@/lib/modules/stage-maps/generate";
import { MAP_HEIGHT, MAP_WIDTH } from "@/features/types/TileTypes";
import type { MapNodeSnapshot, MineState } from "./types";

export interface PersistOptions {
  prevState: MineState;
  nextState: MineState;
  stageComplete: boolean;
}

export type PersistStatus = "ok" | "conflict" | "failed";

export interface PersistResult {
  status: PersistStatus;
  errors?: string[];
  stageAdvanced: boolean;
  /** The exact state committed to canonical storage and the recovery snapshot. */
  committedState?: MineState;
}

class PersistenceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceConflictError";
  }
}

/**
 * True when an error indicates the MongoDB deployment does not support
 * multi-document transactions (i.e. it is a standalone server rather than a
 * replica set / mongos). In that case the caller should retry the writes
 * sequentially without a session.
 */
function isTransactionUnsupportedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: number; codeName?: string; message?: string };
  // 20 = IllegalOperation (standalone), 263 = OperationNotSupportedInTransaction.
  if (err.code === 20 || err.code === 263) return true;
  if (err.codeName === "IllegalOperation") return true;
  const message = String(err.message ?? "");
  return (
    message.includes("Transaction numbers are only allowed on a replica set") ||
    message.includes("Transactions are not supported") ||
    message.includes("replica set member or mongos") ||
    message.includes("does not support transactions")
  );
}

function mapVersionFilter(wallet: string, state: MineState): Record<string, unknown> {
  // playerId is unique (one stage_maps doc per player), so it fully identifies
  // the row. mapVersion is the optimistic-concurrency guard. We deliberately do
  // NOT filter by `stage` here: `state.stage` is read from the PlayerModel doc,
  // while the stage lives on the StageMapModel doc — two separate records. If
  // they ever drift, adding `stage` to this filter matches zero docs and aborts
  // the whole transaction (including the player coin write) on every flush,
  // silently dropping earned coins.
  const filter: Record<string, unknown> = { playerId: wallet };
  if (state.mapVersion === 0) {
    filter.$or = [{ mapVersion: 0 }, { mapVersion: { $exists: false } }];
  } else {
    filter.mapVersion = state.mapVersion;
  }
  return filter;
}

function toStoredNodes(nodes: Record<string, MapNodeSnapshot>) {
  return Object.fromEntries(
    Object.entries(nodes).map(([key, node]) => [
      key,
      {
        x: node.x,
        y: node.y,
        kind: node.kind,
        rarity: node.rarity,
        maxHp: node.maxHp,
        hp: node.hp,
        coins: node.coinReward,
        destroyed: node.destroyed,
      },
    ]),
  );
}

function createNextStageState(state: MineState): {
  state: MineState;
  mapUpdate: Record<string, unknown>;
} {
  const stage = state.stage + 1;
  const seed = rollSeed();
  const generatedNodes = generateStageMap(stage, seed, MAP_WIDTH, MAP_HEIGHT);
  const nodes: Record<string, MapNodeSnapshot> = {};

  for (const node of generatedNodes) {
    nodes[`${node.x},${node.y}`] = {
      x: node.x,
      y: node.y,
      kind: node.kind,
      rarity: node.rarity,
      maxHp: node.maxHp,
      hp: node.hp,
      coinReward: node.coins,
      destroyed: node.destroyed,
    };
  }

  const nextState: MineState = {
    ...state,
    stage,
    nodes,
    totalNodes: generatedNodes.length,
    destroyedNodes: 0,
    mapVersion: 0,
    lastActionAt: 0,
  };

  return {
    state: nextState,
    mapUpdate: {
      stage,
      seed,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      nodes: toStoredNodes(nodes),
      totalChests: generatedNodes.filter((node) => node.kind === "chest").length,
      clearedChests: 0,
      mapVersion: 0,
      lastActionAt: 0,
    },
  };
}

async function persistInTransaction(
  opts: PersistOptions,
  session: ClientSession | null,
): Promise<{ stageAdvanced: boolean; committedState: MineState }> {
  const { prevState, nextState, stageComplete } = opts;
  const wallet = nextState.wallet;
  // When no transaction is available (standalone MongoDB) we still pass the
  // session-less options object so the same query code path is reused.
  const writeOpts = session ? { session } : {};
  const clearedChests = Object.values(nextState.nodes).filter(
    (node) => node.kind === "chest" && node.destroyed,
  ).length;
  const stageTransition = stageComplete ? createNextStageState(nextState) : null;
  const committedState = stageTransition?.state ?? nextState;

  const mapResult = await StageMapModel.updateOne(
    mapVersionFilter(wallet, prevState),
    {
      $set: stageTransition?.mapUpdate ?? {
        nodes: toStoredNodes(nextState.nodes),
        clearedChests,
        mapVersion: nextState.mapVersion,
        lastActionAt: nextState.lastActionAt,
      },
    },
    writeOpts,
  );

  if (mapResult.matchedCount !== 1) {
    throw new PersistenceConflictError(
      `Stage map changed before version ${prevState.mapVersion} could be committed`,
    );
  }

  // Hero energy is derived from the map which is already CAS-guarded above.
  // Guarding per-hero energy causes conflicts when e.g. a regen tick or another
  // route updated energy between reads. Just set the authoritative value.
  for (const [heroId, hero] of Object.entries(nextState.heroes)) {
    const result = await HeroModel.updateOne(
      { _id: heroId, ownerWallet: wallet },
      { $set: { currentEnergy: hero.currentEnergy, ...(hero.currentEnergy === 0 ? { onMap: false } : {}) } },
      writeOpts,
    );
    if (result.matchedCount !== 1) {
      throw new PersistenceConflictError(`Hero ${heroId} is no longer available to ${wallet}`);
    }
  }

  // Player coins and stage are derived from the map which is already version-guarded
  // above. Guarding here too causes spurious conflicts when coins drift due to
  // concurrent legacy routes or rounding. Only guard wallet existence.
  const playerResult = await PlayerModel.updateOne(
    { wallet },
    { $set: { coins: nextState.coins, stage: committedState.stage } },
    writeOpts,
  );
  if (playerResult.matchedCount !== 1) {
    throw new PersistenceConflictError(`Player ${wallet} no longer exists`);
  }

  return { stageAdvanced: stageComplete, committedState };
}

export interface ChestDestroyOptions {
  /** State BEFORE the detonation (used as the CAS baseline). */
  prevState: MineState;
  /** State AFTER the detonation (contains the updated nodes + coins). */
  nextState: MineState;
}

/**
 * Atomically writes the map node snapshot and player coin balance when at
 * least one chest was destroyed in a single detonation.
 *
 * This is intentionally narrower than persistMineAction: it does NOT write
 * hero energy or handle stage transitions — the FlushScheduler handles those.
 * By writing immediately on every chest destroy the player's earned coins and
 * the destroyed node state are in DB before the next bootstrap read, so a
 * browser refresh cannot resurrect already-cleared chests or lose coins.
 *
 * Returns "ok" on success, "conflict" if the mapVersion CAS check failed
 * (caller should let the next FlushScheduler cycle handle recovery),
 * or "failed" for unexpected errors.
 */
export async function persistChestDestroy(
  opts: ChestDestroyOptions,
): Promise<Pick<PersistResult, "status">> {
  await connectDatabase();
  const { prevState, nextState } = opts;
  const wallet = nextState.wallet;

  const clearedChests = Object.values(nextState.nodes).filter(
    (n) => n.kind === "chest" && n.destroyed,
  ).length;

  async function doWrite(session: ClientSession | null) {
    const writeOpts = session ? { session } : {};

    const mapResult = await StageMapModel.updateOne(
      mapVersionFilter(wallet, prevState),
      {
        $set: {
          nodes: toStoredNodes(nextState.nodes),
          clearedChests,
          mapVersion: nextState.mapVersion,
          lastActionAt: nextState.lastActionAt,
        },
      },
      writeOpts,
    );

    if (mapResult.matchedCount !== 1) {
      throw new PersistenceConflictError(
        `Chest-destroy CAS failed at version ${prevState.mapVersion}`,
      );
    }

    await PlayerModel.updateOne(
      { wallet },
      { $set: { coins: nextState.coins } },
      writeOpts,
    );
  }

  const session = await mongoose.startSession();
  try {
    try {
      await session.withTransaction(() => doWrite(session));
    } catch (txError) {
      if (txError instanceof PersistenceConflictError) throw txError;
      if (!isTransactionUnsupportedError(txError)) throw txError;
      await doWrite(null);
    }
    return { status: "ok" };
  } catch (error) {
    if (error instanceof PersistenceConflictError) {
      return { status: "conflict" };
    }
    console.error("[persistChestDestroy] unexpected error:", error);
    return { status: "failed" };
  } finally {
    await session.endSession();
  }
}

export async function persistMineAction(opts: PersistOptions): Promise<PersistResult> {
  await connectDatabase();
  const session = await mongoose.startSession();
  // Legacy HTTP callers derive state without incrementing the websocket
  // counter. Ensure every non-stage mutation still advances the CAS token.
  const normalizedOptions = opts.stageComplete || opts.nextState.mapVersion > opts.prevState.mapVersion
    ? opts
    : {
        ...opts,
        nextState: {
          ...opts.nextState,
          mapVersion: opts.prevState.mapVersion + 1,
        },
      };

  try {
    let committed: { stageAdvanced: boolean; committedState: MineState } | undefined;

    try {
      // Preferred path: a single multi-document transaction (requires a
      // MongoDB replica set / Atlas).
      await session.withTransaction(async () => {
        committed = await persistInTransaction(normalizedOptions, session);
      });
    } catch (txError) {
      // A genuine version conflict must surface — never retry it.
      if (txError instanceof PersistenceConflictError) throw txError;

      // Standalone MongoDB (common for self-hosted / VPS / dev) does not
      // support transactions and throws here. Without this fallback every 30s
      // flush fails silently and the player's map appears to "reset" on
      // reconnect because nothing was ever written to the DB. Retry the same
      // writes sequentially without a session.
      if (!isTransactionUnsupportedError(txError)) throw txError;

      console.warn(
        "[persistMineAction] transactions unavailable — falling back to sequential writes:",
        txError instanceof Error ? txError.message : String(txError),
      );
      committed = await persistInTransaction(normalizedOptions, null);
    }

    if (!committed) {
      return { status: "failed", errors: ["Transaction completed without a committed state"], stageAdvanced: false };
    }

    return { status: "ok", ...committed };
  } catch (error) {
    if (error instanceof PersistenceConflictError) {
      return { status: "conflict", errors: [error.message], stageAdvanced: false };
    }
    return { status: "failed", errors: [String(error)], stageAdvanced: false };
  } finally {
    await session.endSession();
  }
}

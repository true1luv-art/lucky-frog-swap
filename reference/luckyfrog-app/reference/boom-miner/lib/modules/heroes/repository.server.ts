import { HeroModel } from "./model.server";
import type { IHero } from "./types.server";
import { generateHero } from "./generate";
import { HeroRarity } from "@/features/types/HeroRarity";
import { connectDatabase } from "@/lib/config/database";
import { MINT_COST, MAX_ON_MAP, RARITY_RECOVERY_FRACTION, RECOVERY_INTERVAL_SECONDS } from "@/lib/constants/game";
import { verifyDepositFromPlayer } from "@/lib/chain/verify";
import {
  claimProcessedTransaction,
  findProcessedTransaction,
  patchTransactionMetadata,
} from "@/lib/modules/transactions-processed/repository.server";

export type { IHero } from "./types.server";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getHeroesByWallet(wallet: string): Promise<IHero[]> {
  await connectDatabase();
  return HeroModel.find({ ownerWallet: wallet }).lean<IHero[]>();
}

/**
 * Fetches heroes by their Mongoose _id strings. Used by the shop to load
 * freshly minted heroes from the metadata heroIds immediately after settlement,
 * without waiting for the WebSocket roster refresh.
 */
export async function getHeroesByIds(ids: string[]): Promise<IHero[]> {
  await connectDatabase();
  if (ids.length === 0) return [];
  return HeroModel.find({ _id: { $in: ids } }).lean<IHero[]>();
}

/**
 * Returns the next available minted_number by finding the global max across
 * ALL heroes in the collection and adding 1. This is the authoritative source
 * of truth — the client must NEVER derive this from its local roster count.
 */
export async function getNextMintedNumber(): Promise<number> {
  await connectDatabase();
  const result = await HeroModel.findOne({}, { minted_number: 1 })
    .sort({ minted_number: -1 })
    .lean<{ minted_number: number }>();
  return (result?.minted_number ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Starter hero (one Common hero, onMap:true)
// ---------------------------------------------------------------------------

/**
 * Ensures the player has at least one hero. If the roster is empty, creates
 * one Common starter hero with onMap=true. Returns the full roster.
 */
export async function ensureStarterHero(wallet: string): Promise<IHero[]> {
  await connectDatabase();
  const existing = await HeroModel.find({ ownerWallet: wallet }).lean<IHero[]>();
  if (existing.length > 0) return existing;

  const totalCount = await HeroModel.countDocuments();
  const seed = { ...generateHero(wallet, totalCount + 1, HeroRarity.Common), onMap: true };
  await HeroModel.create(seed);
  return HeroModel.find({ ownerWallet: wallet }).lean<IHero[]>();
}

// ---------------------------------------------------------------------------
// Mint (client-transfer)
// ---------------------------------------------------------------------------

/** Machine-readable failure codes surfaced by verifyAndMintHeroes. */
export type MintErrorCode =
  | "INVALID_MINTED_NUMBERS"
  | "ALREADY_PROCESSED"
  | "NOT_CONFIRMED"
  | "VERIFICATION_FAILED";

export interface VerifyAndMintResult {
  ok:      boolean;
  code?:   MintErrorCode;
  error?:  string;
  heroes:  IHero[];
}

/** Options controlling how the worker verifies the on-chain payment. */
export interface VerifyAndMintOptions {
  /** Confirmation polls before returning NOT_CONFIRMED. Worker passes a small value. */
  verifyMaxTries?: number;
  /** Delay between confirmation polls, in ms. */
  verifyDelayMs?: number;
}

/**
 * Verifies an on-chain player -> treasury payment and, if valid, mints
 * `count` heroes for `wallet`.
 *
 * Minting is no longer paid with in-game coins. Instead the player signs a
 * token transfer in the browser (lib/client/solana/deposit.ts); this function:
 *   1. Verifies the transfer landed on-chain: signed by `wallet`, treasury
 *      received exactly count × MINT_COST of the configured mint.
 *   2. Atomically claims the signature in the settlement ledger (unique index)
 *      so the same transaction can never mint twice.
 *   3. Inserts the hero documents.
 *
 * `mintedNumbers` are the sequential display numbers assigned by the client —
 * one per hero, in order. Stored as-is.
 */
export async function verifyAndMintHeroes(
  wallet: string,
  count: number,
  mintedNumbers: number[],
  txId: string,
  opts: VerifyAndMintOptions = {},
): Promise<VerifyAndMintResult> {
  await connectDatabase();

  if (mintedNumbers.length !== count) {
    return { ok: false, code: "INVALID_MINTED_NUMBERS", error: "minted_numbers length mismatch", heroes: [] };
  }

  const cost = count * MINT_COST;

  // 1. Verify the on-chain transfer before touching the DB. In the worker we
  //    poll only briefly and let the queue retry a not-yet-confirmed payment.
  const verification = await verifyDepositFromPlayer(txId, wallet, cost, {
    maxTries: opts.verifyMaxTries,
    delayMs:  opts.verifyDelayMs,
  });
  if (!verification.valid) {
    // NOT_CONFIRMED is transient (retry); everything else is terminal.
    const code: MintErrorCode =
      verification.code === "NOT_CONFIRMED" ? "NOT_CONFIRMED" : "VERIFICATION_FAILED";
    return {
      ok:    false,
      code,
      error: verification.reason ?? "On-chain payment could not be verified",
      heroes: [],
    };
  }

  // 2. Claim the signature — atomic idempotency gate. A replay (or concurrent
  //    duplicate request) with the same txId gets claimed:false and mints nothing.
  const { claimed } = await claimProcessedTransaction({
    txHash: txId,
    wallet,
    type:   "mint",
    amount: -cost,
    // metadata.heroIds will be patched in below after insertMany succeeds
    metadata: {
      type: "mint",
      heroIds: [],
      mintedNumbers,
      count,
    },
  });

  if (!claimed) {
    // The ledger row already exists. Check whether heroes were actually inserted —
    // if the worker crashed between claimProcessedTransaction and insertMany,
    // the heroes are missing and we must recover them here.
    const existing = await findProcessedTransaction(txId);
    const storedIds: string[] = (existing?.metadata as { heroIds?: string[] } | undefined)?.heroIds ?? [];

    if (storedIds.length === count) {
      // Heroes were fully inserted on a prior run — return them.
      const heroes = await HeroModel.find({ _id: { $in: storedIds } }).lean<IHero[]>();
      return { ok: true, heroes };
    }

    // heroIds is empty (crash between claim and insert) — re-insert now.
    // Re-run insertMany idempotently by checking which minted_numbers already exist.
    const alreadyMinted = await HeroModel.find({
      ownerWallet: wallet,
      minted_number: { $in: mintedNumbers },
    }).lean<IHero[]>();

    const alreadyNumbers = new Set(alreadyMinted.map((h) => h.minted_number));
    const missing = mintedNumbers.filter((n) => !alreadyNumbers.has(n));

    let recovered: IHero[] = [...alreadyMinted];
    if (missing.length > 0) {
      const seeds = missing.map((n) => generateHero(wallet, n));
      const newDocs = await HeroModel.insertMany(seeds);
      recovered = [...recovered, ...(newDocs as unknown as IHero[])];
    }

    // Patch the metadata with the recovered hero IDs.
    await patchTransactionMetadata(txId, {
      type: "mint",
      heroIds: recovered.map((h) => String(h._id)),
      mintedNumbers,
      count,
    });

    return { ok: true, heroes: recovered };
  }

  // 3. Insert the heroes and patch metadata with their IDs.
  const seeds = mintedNumbers.map((n) => generateHero(wallet, n));
  const docs  = await HeroModel.insertMany(seeds);
  const heroes = docs as unknown as IHero[];

  // Patch the metadata with the real hero ObjectIds now that we have them.
  await patchTransactionMetadata(txId, {
    type: "mint",
    heroIds: heroes.map((h) => String(h._id)),
    mintedNumbers,
    count,
  });

  return { ok: true, heroes };
}

// ---------------------------------------------------------------------------
// Deploy / recall
// ---------------------------------------------------------------------------

/**
 * Toggles `onMap` for a single hero, enforcing server-side limits.
 * Returns the updated hero, or null if the constraints block the change.
 */
export async function setHeroOnMap(
  wallet: string,
  heroDocId: string,
  onMap: boolean,
): Promise<IHero | null> {
  await connectDatabase();

  const hero = await HeroModel.findOne({ _id: heroDocId, ownerWallet: wallet }).lean<IHero>();
  if (!hero) return null;

  if (onMap) {
    // Cannot deploy if energy < 1.
    if (hero.currentEnergy < 1) return null;
    // Cannot exceed MAX_ON_MAP.
    const onMapCount = await HeroModel.countDocuments({ ownerWallet: wallet, onMap: true });
    if (onMapCount >= MAX_ON_MAP) return null;
  }

  return HeroModel.findOneAndUpdate(
    { _id: heroDocId, ownerWallet: wallet },
    { $set: { onMap } },
    { new: true, lean: true },
  ) as unknown as IHero | null;
}

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------

/**
 * Consumes 1 energy. If energy reaches 0 the hero is recalled from the map.
 */
export async function consumeHeroEnergy(
  wallet: string,
  heroDocId: string,
): Promise<IHero | null> {
  await connectDatabase();
  const hero = await HeroModel.findOne({ _id: heroDocId, ownerWallet: wallet }, { currentEnergy: 1 }).lean<{ currentEnergy: number }>();
  if (!hero) return null;

  const next = Math.max(0, hero.currentEnergy - 1);
  return HeroModel.findOneAndUpdate(
    { _id: heroDocId, ownerWallet: wallet },
    { $set: { currentEnergy: next, ...(next === 0 ? { onMap: false } : {}) } },
    { new: true, lean: true },
  ) as unknown as IHero | null;
}

/**
 * Ticks energy regen for all resting heroes owned by `wallet`.
 * Called on a periodic cadence (Phase S).
 *
 * Each hero recovers RARITY_RECOVERY_FRACTION[rarity] of their maxEnergy per
 * RECOVERY_INTERVAL_SECONDS tick — same 5-min interval for all rarities, but
 * rarer heroes recover a larger fraction so they reach full energy faster:
 *
 *   common     5.00% / 5 min → full in 100 min
 *   uncommon   6.25% / 5 min → full in  80 min
 *   rare       8.33% / 5 min → full in  60 min
 *   epic      10.00% / 5 min → full in  50 min
 *   legendary 12.50% / 5 min → full in  40 min
 */
export async function regenHeroEnergy(
  wallet: string,
  deltaSec: number,
): Promise<void> {
  await connectDatabase();

  const now   = Date.now();
  const heroes = await HeroModel.find({ ownerWallet: wallet, onMap: false }).lean<IHero[]>();
  const ops = heroes
    .filter((h) => h.currentEnergy < h.maxEnergy)
    .map((h) => {
      const rarity   = (h.rarity as string ?? "common").toLowerCase();
      const fraction = RARITY_RECOVERY_FRACTION[rarity] ?? RARITY_RECOVERY_FRACTION.common;
      const gain     = (h.maxEnergy * fraction * deltaSec) / RECOVERY_INTERVAL_SECONDS;
      const next     = Math.min(h.maxEnergy, h.currentEnergy + gain);
      return HeroModel.updateOne({ _id: h._id }, { $set: { currentEnergy: next, lastRegenAt: now } });
    });
  await Promise.all(ops);
}

/**
 * Catches up offline regen for a player's resting heroes on WS connect.
 *
 * The RegenScheduler only ticks while a session is live in the SessionStore.
 * When a player returns after hours away, their heroes would still show the
 * energy value from their last session — no regen applied in the gap.
 *
 * This function reads each hero's `lastRegenAt` timestamp (set by every
 * regenHeroEnergy write) and computes how much offline time has elapsed,
 * then applies exactly one regen pass for that delta before returning.
 * Called once per wallet in handlers.ts immediately after the SessionStore
 * entry is created so the first SESSION_STATE push has up-to-date energy.
 */
export async function catchUpOfflineRegen(wallet: string): Promise<void> {
  await connectDatabase();

  const now    = Date.now();
  const heroes = await HeroModel.find({ ownerWallet: wallet, onMap: false }).lean<IHero[]>();

  const ops = heroes
    .filter((h) => h.currentEnergy < h.maxEnergy)
    .map((h) => {
      // lastRegenAt is 0 for legacy heroes — use updatedAt as a reasonable proxy.
      const lastTick = h.lastRegenAt > 0
        ? h.lastRegenAt
        : (h.updatedAt ? new Date(h.updatedAt).getTime() : 0);

      if (lastTick <= 0) return null; // no baseline — skip to avoid crediting infinite regen
      const deltaSec = (now - lastTick) / 1000;
      if (deltaSec < 1) return null;

      const rarity   = (h.rarity as string ?? "common").toLowerCase();
      const fraction = RARITY_RECOVERY_FRACTION[rarity] ?? RARITY_RECOVERY_FRACTION.common;
      const gain     = (h.maxEnergy * fraction * deltaSec) / RECOVERY_INTERVAL_SECONDS;
      const next     = Math.min(h.maxEnergy, h.currentEnergy + gain);
      if (next <= h.currentEnergy) return null;

      return HeroModel.updateOne(
        { _id: h._id },
        { $set: { currentEnergy: next, lastRegenAt: now } },
      );
    })
    .filter(Boolean) as ReturnType<typeof HeroModel.updateOne>[];

  if (ops.length > 0) await Promise.all(ops);
}

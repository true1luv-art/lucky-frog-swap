import { PlayerModel } from "./model.server";
import { connectDatabase } from "@/lib/config/database";
import { insertProcessedTransaction } from "@/lib/modules/transactions-processed/repository.server";
import { HeroModel } from "@/lib/modules/heroes/model.server";
import { DAILY_CHEST_CAP_PER_HERO } from "@/lib/constants/game";

export type { IPlayer } from "./types.server";

// ---------------------------------------------------------------------------
// Withdrawal
// ---------------------------------------------------------------------------

/** Machine-readable error codes surfaced by `withdrawCoins`. */
export type WithdrawErrorCode =
  | "INVALID_AMOUNT"
  | "NOT_FOUND"
  | "EXCEEDS_LIMIT"
  | "INSUFFICIENT_COINS"
  | "TREASURY_INSUFFICIENT"
  | "TX_REVERTED";

export class WithdrawError extends Error {
  constructor(
    public code: WithdrawErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WithdrawError";
  }
}

export interface WithdrawResult {
  coins: number;
  withdrawnToday: number;
  txHash: string;
}

/** True when two unix-ms timestamps fall on the same UTC calendar day. */
function sameUtcDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

/**
 * Settles a withdrawal: validates rules, sends tokens on-chain, then atomically
 * debits coins and records the ledger row.
 *
 * Order is deliberate (on-chain first, DB debit second) so we never debit a
 * player for a transfer that failed to broadcast. The chain send is injected
 * (`sendOnChain`) so this repository stays free of any `lib/chain` import and
 * remains chain-agnostic.
 *
 * `signature` is the queue idempotency key, used as the transfer memo ref.
 */
export async function withdrawCoins(
  wallet: string,
  amount: number,
  signature: string,
  sendOnChain: (playerWallet: string, amount: number, ref: string) => Promise<{ signature: string }>,
): Promise<WithdrawResult> {
  await connectDatabase();

  // 1. Validate amount.
  if (!Number.isInteger(amount) || amount < 1) {
    throw new WithdrawError("INVALID_AMOUNT", "Amount must be an integer >= 1");
  }

  // 2. Load player + enforce rules.
  const player = await PlayerModel.findOne({ wallet }).lean<{
    coins: number;
    withdrawnToday: number;
    lastWithdrawnAt: number;
  } | null>();
  if (!player) throw new WithdrawError("NOT_FOUND", "Player not found");

  const now = Date.now();
  // No daily withdrawal limit is enforced for now. We still maintain the
  // `withdrawnToday` / `lastWithdrawnAt` tracking fields (reset lazily when the
  // last withdrawal was on a prior UTC day) so a cap can be re-introduced later
  // without a data migration.
  const withdrawnToday =
    player.lastWithdrawnAt && sameUtcDay(player.lastWithdrawnAt, now)
      ? player.withdrawnToday
      : 0;

  if (player.coins < amount) {
    throw new WithdrawError("INSUFFICIENT_COINS", "Insufficient coin balance");
  }

  // 3. Send on-chain first. Map known chain errors onto withdrawal codes.
  let txHash: string;
  try {
    const res = await sendOnChain(wallet, amount, signature);
    txHash = res.signature;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "TREASURY_INSUFFICIENT") {
      throw new WithdrawError("TREASURY_INSUFFICIENT", "Treasury balance insufficient");
    }
    throw new WithdrawError(
      "TX_REVERTED",
      err instanceof Error ? err.message : "On-chain transfer failed",
    );
  }

  // 4. Atomically debit coins + advance the daily counter.
  //    Guard on coins >= amount so a concurrent debit can't overdraw.
  const updated = await PlayerModel.findOneAndUpdate(
    { wallet, coins: { $gte: amount } },
    {
      $inc: { coins: -amount },
      $set: { withdrawnToday: withdrawnToday + amount, lastWithdrawnAt: now },
    },
    { new: true },
  ).lean<{ coins: number; withdrawnToday: number } | null>();

  if (!updated) {
    // On-chain succeeded but the DB debit didn't apply (balance changed under
    // us). Log loudly — the tokens have already left the treasury.
    console.error(
      `[withdrawCoins] CRITICAL: on-chain send ${txHash} succeeded for ${wallet} ` +
        `but coin debit of ${amount} failed (balance changed). Manual reconciliation needed.`,
    );
    throw new WithdrawError("INSUFFICIENT_COINS", "Balance changed during settlement");
  }

  // 5. Record the ledger row (idempotent on txHash).
  await insertProcessedTransaction({
    txHash,
    wallet,
    type: "withdrawal",
    amount: -amount,
  });

  return {
    coins: updated.coins,
    withdrawnToday: updated.withdrawnToday,
    txHash,
  };
}

// ---------------------------------------------------------------------------
// Daily chest cap
// ---------------------------------------------------------------------------

/**
 * Computes the account's daily chest cap by summing cap_per_hero[rarity]
 * across every hero the player owns, regardless of whether they are on the map.
 *
 * This is the mechanic that makes collecting heroes valuable: owning more
 * heroes — even off-map — raises the daily earnings ceiling.
 */
export async function computeDailyChestCap(wallet: string): Promise<number> {
  await connectDatabase();
  const heroes = await HeroModel.find(
    { ownerWallet: wallet },
    { rarity: 1 },
  ).lean<{ rarity: string }[]>();

  return heroes.reduce((sum, h) => {
    const rarity = (h.rarity ?? "common").toLowerCase();
    return sum + (DAILY_CHEST_CAP_PER_HERO[rarity] ?? DAILY_CHEST_CAP_PER_HERO.common);
  }, 0);
}

/**
 * Attempts to record one chest cleared for the player.
 *
 * - Lazily resets `dailyChestsCleared` to 0 when the last reset was on a
 *   prior UTC day.
 * - Returns `{ allowed: true, dailyChestsCleared }` when the chest is within
 *   the cap, with the new counter value.
 * - Returns `{ allowed: false }` when the cap is already reached — the caller
 *   must NOT credit coin rewards for this chest.
 */
export async function recordChestCleared(
  wallet: string,
): Promise<{ allowed: boolean; dailyChestsCleared?: number; cap?: number }> {
  await connectDatabase();

  const cap = await computeDailyChestCap(wallet);

  const player = await PlayerModel.findOne(
    { wallet },
    { dailyChestsCleared: 1, dailyChestsResetAt: 1 },
  ).lean<{ dailyChestsCleared: number; dailyChestsResetAt: number }>();

  if (!player) return { allowed: false };

  const now = Date.now();
  const needsReset = !sameUtcDay(player.dailyChestsResetAt || 0, now);
  const currentCount = needsReset ? 0 : (player.dailyChestsCleared ?? 0);

  if (currentCount >= cap) {
    return { allowed: false, cap };
  }

  // Atomically increment — also handles the lazy reset in the same write.
  await PlayerModel.updateOne(
    { wallet },
    {
      $set: needsReset ? { dailyChestsResetAt: now } : {},
      $inc: { dailyChestsCleared: needsReset ? 1 - (player.dailyChestsCleared ?? 0) : 1 },
    },
  );

  return { allowed: true, dailyChestsCleared: currentCount + 1, cap };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findPlayerByWallet(wallet: string) {
  await connectDatabase();
  return PlayerModel.findOne({ wallet }).lean();
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createPlayer(input: { wallet: string; username?: string }) {
  await connectDatabase();
  return PlayerModel.create({
    wallet:           input.wallet,
    username:         input.username,
    registrationTime: Date.now(),
    coins:            0,
    stage:            1,
  });
}

export async function updatePlayerState(
  wallet: string,
  updates: Partial<{ username: string; coins: number; stage: number }>,
) {
  await connectDatabase();
  return PlayerModel.findOneAndUpdate(
    { wallet },
    { $set: updates },
    { new: true },
  ).lean();
}

// ---------------------------------------------------------------------------
// Balance mutations — atomic $inc
// ---------------------------------------------------------------------------

/**
 * Credits `amount` to the player's coin balance (atomic).
 */
export async function addCoins(wallet: string, amount: number): Promise<void> {
  await connectDatabase();
  await PlayerModel.updateOne({ wallet }, { $inc: { coins: amount } });
}

/**
 * Deducts `amount` from the player's coin balance, clamped to 0.
 * Uses a conditional update to prevent negative balances.
 */
export async function deductCoins(wallet: string, amount: number): Promise<{ ok: boolean }> {
  await connectDatabase();
  const result = await PlayerModel.updateOne(
    { wallet, coins: { $gte: amount } },
    { $inc: { coins: -amount } },
  );
  return { ok: result.modifiedCount > 0 };
}

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

export async function setStage(wallet: string, stage: number): Promise<void> {
  await connectDatabase();
  await PlayerModel.updateOne({ wallet }, { $set: { stage } });
}

/**
 * server/luckfrog-smart-contract-test/settlement/escrow.ts
 *
 * Market/escrow wallet primitives shared by the watcher and (in later phases)
 * the settlement consumer:
 *   - one confirmed-commitment RPC connection (lazy singleton),
 *   - the MARKET_TEST escrow keypair (verified against MARKET_TEST_ADDRESS),
 *   - SPL Token-2022 helpers (mint decimals, market ATA, outbound transfer).
 *
 * Phase 1 only reads (decimals / ATA / signatures). The outbound `transferTokens`
 * helper is ported here now so the egg-refund and seller-payout flows in later
 * phases can reuse it without touching the watcher.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import mongoose, { Schema, type Document, type Model } from "mongoose";
import {
  RPC_HTTP,
  LFRG_MINT,
  MARKET_TEST_ADDRESS,
  MARKET_TEST_PRIVATE_KEY,
  DEFAULT_DECIMALS,
} from "../config";
import { log } from "../lib/logger";

let _connection: Connection | null = null;

/** Shared confirmed-commitment RPC connection (lazy singleton). */
export function getConnection(): Connection {
  if (!_connection) _connection = new Connection(RPC_HTTP, "confirmed");
  return _connection;
}

let _escrowKeypair: Keypair | null = null;

/**
 * Loads (once) and returns the MARKET_TEST escrow keypair, verifying it matches
 * MARKET_TEST_ADDRESS so a mismatched key/address pair can never silently move
 * funds from the wrong wallet.
 */
export function getEscrowKeypair(): Keypair {
  if (_escrowKeypair) return _escrowKeypair;

  const keypair = Keypair.fromSecretKey(bs58.decode(MARKET_TEST_PRIVATE_KEY));
  if (keypair.publicKey.toBase58() !== MARKET_TEST_ADDRESS) {
    throw new Error(
      "[luckfrog-sc] MARKET_TEST_PRIVATE_KEY does not match MARKET_TEST_ADDRESS.\n" +
        `  Keypair: ${keypair.publicKey.toBase58()}\n` +
        `  Env:     ${MARKET_TEST_ADDRESS}`,
    );
  }

  _escrowKeypair = keypair;
  return keypair;
}

/** PublicKey of the $LFRG mint. */
export function getMintPk(): PublicKey {
  return new PublicKey(LFRG_MINT);
}

/**
 * Fetches the mint's on-chain decimals. Falls back to DEFAULT_DECIMALS (6) and
 * warns loudly if getMint fails — usually a devnet/mainnet mismatch between
 * LFRG_MINT_ADDRESS and the RPC endpoint.
 */
export async function getMintDecimals(): Promise<number> {
  try {
    const mintInfo = await getMint(
      getConnection(),
      getMintPk(),
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    return mintInfo.decimals;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(
      `getMint failed (${msg}). This usually means LFRG_MINT_ADDRESS is wrong ` +
        `for the current RPC network. Falling back to ${DEFAULT_DECIMALS} decimals.`,
    );
    return DEFAULT_DECIMALS;
  }
}

/** Associated token account for the market wallet (Token-2022). */
export function getMarketAta(): Promise<PublicKey> {
  return getAssociatedTokenAddress(
    getMintPk(),
    new PublicKey(MARKET_TEST_ADDRESS),
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/**
 * Transfers `rawAmount` (raw on-chain units) of $LFRG from the market wallet to
 * `recipientPk`, creating the recipient ATA if needed (fee paid by the market
 * wallet). Returns the confirmed signature.
 *
 * Not called in Phase 1 — reserved for egg refunds and seller payouts.
 */
export async function transferTokens(
  recipientPk: PublicKey,
  rawAmount: bigint,
  decimals: number,
): Promise<string> {
  const connection = getConnection();
  const escrow = getEscrowKeypair();
  const mintPk = getMintPk();

  const sourceAta = await getAssociatedTokenAddress(
    mintPk,
    escrow.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const destAtaInfo = await getOrCreateAssociatedTokenAccount(
    connection,
    escrow,
    mintPk,
    recipientPk,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: escrow.publicKey,
    recentBlockhash: blockhash,
  }).add(
    createTransferCheckedInstruction(
      sourceAta,
      mintPk,
      destAtaInfo.address,
      escrow.publicKey,
      rawAmount,
      decimals,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  return sendAndConfirmTransaction(connection, tx, [escrow], {
    commitment: "confirmed",
  });
}

// ---------------------------------------------------------------------------
// Outbound escrow payouts — seller net / buyer refund (Phase 4)
// ---------------------------------------------------------------------------

/**
 * Converts a (possibly fractional) $LFRG amount to raw token units, rounding in
 * decimal space to avoid float drift.
 */
function toRawAmount(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("payout amount must be a positive finite number");
  }
  return BigInt(Math.round(amount * 10 ** decimals));
}

let _cachedDecimals: number | null = null;

/**
 * Sends `amount` $LFRG (human units) OUT of the market/escrow wallet to
 * `recipient`, creating the recipient ATA if needed (escrow pays the rent so the
 * recipient nets the full amount). Returns the confirmed signature. Throws on
 * any RPC / balance / config failure — the caller retries / dead-letters.
 */
export async function sendEscrowPayout(
  recipient: string,
  amount: number,
): Promise<string> {
  if (_cachedDecimals === null) _cachedDecimals = await getMintDecimals();
  const rawAmount = toRawAmount(amount, _cachedDecimals);
  return transferTokens(new PublicKey(recipient), rawAmount, _cachedDecimals);
}

// ---------------------------------------------------------------------------
// Payout ledger — idempotency record for completed escrow payouts
// ---------------------------------------------------------------------------

interface IPayoutLedger extends Document {
  /** `<kind>:<refSignature>` — unique idempotency key for this payout. */
  refKey: string;
  kind: "seller_payout" | "buyer_refund";
  recipient: string;
  amount: number;
  /** The on-chain signature of the escrow payout transfer. */
  payoutSignature: string;
  createdAt: Date;
}

const PayoutLedgerSchema = new Schema<IPayoutLedger>(
  {
    refKey:          { type: String, required: true, unique: true },
    kind:            { type: String, enum: ["seller_payout", "buyer_refund"], required: true },
    recipient:       { type: String, required: true },
    amount:          { type: Number, required: true },
    payoutSignature: { type: String, required: true },
  },
  { collection: "marketplace_payout_ledger", timestamps: true },
);

const PayoutLedgerModel: Model<IPayoutLedger> =
  (mongoose.models.MarketplacePayoutLedger as Model<IPayoutLedger>) ??
  mongoose.model<IPayoutLedger>("MarketplacePayoutLedger", PayoutLedgerSchema);

export type PayoutSettleResult =
  | { status: "ok"; signature: string }
  | { status: "already-paid" };

/**
 * Settles a single outbound escrow payout job (seller net or buyer refund).
 *
 * Idempotency: the `marketplace_payout_ledger` collection records every
 * completed payout keyed on `refKey`. The drain checks the ledger before sending
 * and records it after — giving at-least-once delivery with a best-effort
 * duplicate guard. The queue's unique job signature prevents duplicate JOBS; the
 * ledger prevents re-paying a job that already completed in a prior drain cycle.
 *
 * @throws on transfer failure — the caller retries / dead-letters.
 */
export async function settlePayoutJob(
  refKey: string,
  kind: "seller_payout" | "buyer_refund",
  recipient: string,
  amount: number,
): Promise<PayoutSettleResult> {
  // Already paid in a prior drain cycle?
  const already = await PayoutLedgerModel.countDocuments({ refKey });
  if (already > 0) return { status: "already-paid" };

  // Move the funds (throws on RPC / balance / config failure → retry).
  const signature = await sendEscrowPayout(recipient, amount);

  // Record the completed payout. A duplicate (E11000) means a concurrent drain
  // already recorded it — harmless, treat as success.
  try {
    await PayoutLedgerModel.create({ refKey, kind, recipient, amount, payoutSignature: signature });
  } catch (err) {
    const mongoErr = err as { code?: number };
    if (mongoErr?.code !== 11000) {
      log.error(
        `Payout ${refKey} SENT (sig: ${signature}) but ledger write failed. ` +
          `Manual reconciliation may be required to prevent a retry double-pay.`,
        err,
      );
    }
  }

  return { status: "ok", signature };
}

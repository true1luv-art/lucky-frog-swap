/**
 * Solana payment helpers for on-chain marketplace purchases — ESCROW model.
 *
 * Mirrors lib/solana/payments.ts (egg / stash) but for marketplace trades. The
 * LuckyFrog-Smart-Contract runs an escrow: the buyer pays the FULL price into
 * the MARKET_TEST wallet, which then (after the asset transfers) pays the seller
 * their 95 % net and keeps the 5 % fee — refunding the buyer if settlement fails.
 *
 * createMarketplacePurchaseTransaction — builds (but does NOT sign) a
 *   Transaction with:
 *     • SPL-token transfer  totalPrice → MARKET_TEST wallet  (escrow deposit)
 *     • a Memo instruction  `tm_purchase-<hash>`             (binds tx ↔ listing)
 *   The buyer is the fee payer and signs via Phantom. There is NO direct
 *   seller payout leg — the seller is paid out of escrow on settlement.
 *
 * verifyMarketplacePayment — confirms a broadcast txHash on-chain and checks
 *   that the buyer deposited ≥ totalPrice into the MARKET_TEST ATA AND that the
 *   required `tm_purchase-<hash>` memo is present.
 *
 * Amounts are denominated in Game Balance = $LFRG 1:1 and may be fractional
 * (e.g. a 0.05 price), so raw conversion rounds to the mint's decimal places.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ParsedTransactionWithMeta,
  ParsedInstruction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAccount,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";
import { config } from "@/lib/config/config";
import {
  buildMemoInstruction,
  buildMarketMemo,
  buildMarketAction,
} from "@/lib/solana/memo";
import { extractMemoStrings, flattenInstructions } from "@/lib/solana/parse-purchase";

// ---------------------------------------------------------------------------
// Connection — fresh each call so env vars are read at request time.
// ---------------------------------------------------------------------------

function getConnection(): Connection {
  const heliusKey = process.env.HELIUS_API_KEY;
  const rpc = heliusKey
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
    : process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  return new Connection(rpc, "confirmed");
}

/**
 * Converts a (possibly fractional) Game Balance amount to raw token units for a
 * mint with `decimals` places. Rounds to the nearest raw unit.
 */
export function toRawAmount(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("amount must be a non-negative finite number");
  }
  // Round in decimal space to avoid float drift, then to a BigInt.
  const scaled = Math.round(amount * 10 ** decimals);
  return BigInt(scaled);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketplaceTransactionData {
  /** Base64-encoded serialized unsigned Transaction. */
  transaction: string;
  /** The wallet that must sign (the buyer's wallet). */
  feePayer: string;
  /** The JSON memo embedded in the transaction (`tm_purchase-<hash>` action). */
  memo: string;
  /** Human-readable breakdown for UI display (in Game Balance units). */
  split: {
    /** What the seller will receive out of escrow on settlement (95 %). */
    seller: number;
    /** Fee the marketplace retains from escrow (5 %). */
    fee: number;
    /** Total the buyer deposits into the escrow wallet (seller + fee). */
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Build unsigned purchase transaction
// ---------------------------------------------------------------------------

/**
 * Builds an unsigned marketplace purchase transaction (ESCROW):
 *   totalPrice $LFRG → MARKET_TEST wallet   (escrow deposit)
 *   + Memo `tm_purchase-<hash>`
 *
 * The seller is NOT paid here — settlement pays them their net out of escrow.
 * Returns a base64-serialised unsigned Transaction for the buyer to sign via
 * Phantom and broadcast through /api/eggs/broadcast.
 */
export async function createMarketplacePurchaseTransaction(params: {
  buyerWallet: string;
  sellerWallet: string;
  sellerNet: number;
  fee: number;
  /** Listing hash → `tm_purchase-<hash>` action. */
  listingHash: string;
  /** Listing assetId, embedded as `item_number`. */
  assetId: string;
  /** Listing assetType, embedded as `type`. */
  assetType: string;
}): Promise<MarketplaceTransactionData> {
  const { buyerWallet, sellerWallet, sellerNet, fee, listingHash, assetId, assetType } = params;

  if (sellerNet <= 0) throw new Error("sellerNet must be positive");
  if (fee < 0) throw new Error("fee must be non-negative");

  const totalPrice = sellerNet + fee;

  // Standardized JSON memo: routes the tx to marketplace settlement + binds it
  // to this listing hash. Buyer is derived on-chain, never trusted from here.
  const memoObj = buildMarketMemo({
    hash: listingHash,
    assetId,
    assetType,
    seller: sellerWallet,
    amount: totalPrice,
  });
  const memo = JSON.stringify(memoObj);

  const connection = getConnection();

  const mintPk = new PublicKey(config.lfrgMint);
  const buyerPk = new PublicKey(buyerWallet);
  // Escrow wallet — receives the full price and later pays the seller / refunds.
  const escrowPk = new PublicKey(config.marketTestAddress);

  // LFRG uses the Token-2022 program.
  const mintInfo = await getMint(connection, mintPk, "confirmed", TOKEN_2022_PROGRAM_ID);
  const decimals = mintInfo.decimals;

  const totalRaw = toRawAmount(totalPrice, decimals);

  const buyerAta = await getAssociatedTokenAddress(mintPk, buyerPk, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const escrowAta = await getAssociatedTokenAddress(mintPk, escrowPk, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const instructions: TransactionInstruction[] = [];

  // Create the escrow ATA if missing — the buyer (fee payer) pays the rent.
  try {
    await getAccount(connection, escrowAta, "confirmed", TOKEN_2022_PROGRAM_ID);
  } catch (e) {
    if (
      e instanceof TokenAccountNotFoundError ||
      e instanceof TokenInvalidAccountOwnerError
    ) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          buyerPk,
          escrowAta,
          escrowPk,
          mintPk,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }
  }

  // Escrow deposit: buyer → MARKET_TEST wallet (full price).
  instructions.push(
    createTransferCheckedInstruction(
      buyerAta,
      mintPk,
      escrowAta,
      buyerPk,
      totalRaw,
      decimals,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  // Memo instruction — binds this payment to a specific listing.
  instructions.push(buildMemoInstruction(memoObj));

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: buyerPk,
    recentBlockhash: blockhash,
  }).add(...instructions);

  const serialized = tx.serialize({ requireAllSignatures: false });

  return {
    transaction: serialized.toString("base64"),
    feePayer: buyerWallet,
    memo,
    split: { seller: sellerNet, fee, total: totalPrice },
  };
}

// ---------------------------------------------------------------------------
// Verify a broadcast purchase transaction
// ---------------------------------------------------------------------------

/**
 * Confirms that a broadcast marketplace purchase txHash (ESCROW):
 *   1. Is finalised on-chain with no error.
 *   2. Deposits ≥ totalPrice from the buyer into the MARKET_TEST (escrow) ATA.
 *   3. Contains the expected `tm_purchase-<hash>` memo action.
 *
 * `totalPrice` is a Game Balance amount (1:1 with $LFRG); raw conversion uses
 * the mint's decimals. Returns true only when all checks pass. The escrow wallet
 * later pays the seller their net and keeps the fee — none of that is on this
 * transaction, so only the single deposit leg is verified here.
 */
export async function verifyMarketplacePayment(params: {
  txHash: string;
  buyerWallet: string;
  totalPrice: number;
  /** The listing hash expected in the `tm_purchase-<hash>` memo action. */
  expectedHash: string;
}): Promise<boolean> {
  const { txHash, buyerWallet, totalPrice, expectedHash } = params;
  const connection = getConnection();

  let parsed: ParsedTransactionWithMeta | null = null;
  try {
    parsed = await connection.getParsedTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
  } catch {
    return false;
  }

  if (!parsed || parsed.meta?.err) return false;

  const mintStr = config.lfrgMint;
  const mintPk = new PublicKey(mintStr);

  const mintInfo = await getMint(connection, mintPk, "confirmed", TOKEN_2022_PROGRAM_ID);
  const totalRaw = toRawAmount(totalPrice, mintInfo.decimals);

  const allIxs = flattenInstructions(parsed);

  // Required memo — match the `tm_purchase-<hash>` action for this listing.
  const expectedAction = buildMarketAction(expectedHash);
  const memos = extractMemoStrings(parsed);
  const hasMemo = memos.some((raw) => {
    try {
      const obj = JSON.parse(raw) as { action?: unknown };
      return obj?.action === expectedAction;
    } catch {
      return false;
    }
  });
  if (!hasMemo) return false;

  const escrowAtaStr = (
    await getAssociatedTokenAddress(mintPk, new PublicKey(config.marketTestAddress), false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
  ).toBase58();

  // A single deposit ≥ totalPrice from the buyer into the escrow ATA (a wallet
  // may split the deposit across instructions, so accumulate).
  let depositedRaw = 0n;
  for (const ix of allIxs) {
    if ((ix as ParsedInstruction).program !== "spl-token") continue;
    const info = (ix as unknown as {
      parsed?: { info?: { source: string; destination: string; tokenAmount: { amount: string }; mint: string; authority: string } };
    }).parsed?.info;
    if (!info) continue;
    if (info.mint !== mintStr) continue;
    if (info.authority !== buyerWallet) continue;
    if (info.destination !== escrowAtaStr) continue;
    depositedRaw += BigInt(info.tokenAmount.amount);
  }

  return depositedRaw >= totalRaw;
}

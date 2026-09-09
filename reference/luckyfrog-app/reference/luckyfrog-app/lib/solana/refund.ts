/**
 * Test-marketplace refund helper.
 *
 * In the test marketplace flow the buyer pays the MARKET_TEST wallet for an egg,
 * the egg is granted, and then the payment is refunded straight back to the
 * buyer. This module performs that server-side refund: it loads the
 * MARKET_TEST_PRIVATE_KEY, transfers the exact raw LFRG amount that was paid
 * back to the buyer, and returns the confirmed signature.
 *
 * LFRG is a Token-2022 (Pump.fun) mint, so all instructions use
 * TOKEN_2022_PROGRAM_ID. The market wallet pays the fee (and any recipient ATA
 * rent) — the buyer nets the full refund.
 *
 * The private key never leaves the server.
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
import { config } from "@/lib/config/config";

function getConnection(): Connection {
  const heliusKey = process.env.HELIUS_API_KEY;
  const rpc = heliusKey
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
    : process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  return new Connection(rpc, "confirmed");
}

/**
 * Returns true only when the MARKET_TEST wallet is fully configured for refunds.
 */
export function isRefundConfigured(): boolean {
  return !!(config.marketTestPrivateKey && config.marketTestAddress && config.lfrgMint);
}

/**
 * Refunds `rawAmount` LFRG (raw token units, already scaled by decimals) from
 * the MARKET_TEST wallet back to `buyerWallet`. Returns the confirmed refund
 * transaction signature.
 *
 * Throws if the refund infrastructure is not configured or the transfer fails —
 * callers treat a throw as a non-fatal, log-and-continue condition since the egg
 * has already been granted at this point.
 */
export async function refundEggPayment(
  buyerWallet: string,
  rawAmount: bigint,
): Promise<string> {
  if (!isRefundConfigured()) {
    throw new Error("MARKET_TEST refund not configured (address/key/mint missing)");
  }
  if (rawAmount <= 0n) {
    throw new Error("refund amount must be positive");
  }

  const connection = getConnection();
  const marketKeypair = Keypair.fromSecretKey(bs58.decode(config.marketTestPrivateKey));

  // Guard against a mismatched key/address pair silently refunding from the
  // wrong wallet.
  if (marketKeypair.publicKey.toBase58() !== config.marketTestAddress) {
    throw new Error("MARKET_TEST_PRIVATE_KEY does not match MARKET_TEST_ADDRESS");
  }

  const mintPk = new PublicKey(config.lfrgMint);
  const buyerPk = new PublicKey(buyerWallet);

  const mintInfo = await getMint(connection, mintPk, "confirmed", TOKEN_2022_PROGRAM_ID);
  const decimals = mintInfo.decimals;

  const sourceAta = await getAssociatedTokenAddress(
    mintPk,
    marketKeypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Create the buyer's ATA if needed (market wallet pays the rent).
  const destAta = await getOrCreateAssociatedTokenAccount(
    connection,
    marketKeypair,
    mintPk,
    buyerPk,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: marketKeypair.publicKey,
    recentBlockhash: blockhash,
  }).add(
    createTransferCheckedInstruction(
      sourceAta,
      mintPk,
      destAta.address,
      marketKeypair.publicKey,
      rawAmount,
      decimals,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  return sendAndConfirmTransaction(connection, tx, [marketKeypair], {
    commitment: "confirmed",
  });
}

/**
 * Treasury → player SPL-token payout helper.
 *
 * Called by the claim-lfrg event to transfer accrued $LFRG from the treasury
 * wallet to the player's wallet. Requires TREASURY_PRIVATE_KEY in env.
 *
 * NOTE: The treasury keypair never leaves the server. The private key is loaded
 * at runtime from TREASURY_PRIVATE_KEY (base58-encoded) and used to sign
 * a server-side transaction.
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
  getMint,
} from "@solana/spl-token";
import bs58 from "bs58";
import { config } from "@/lib/config/config";

let _connection: Connection | null = null;

function getConnection(): Connection {
  if (!_connection) {
    const rpc = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
    _connection = new Connection(rpc, "confirmed");
  }
  return _connection;
}

/**
 * Transfer `amount` $LFRG (human-readable, not raw) from the treasury wallet
 * to the player's wallet. Returns the confirmed transaction signature.
 *
 * Throws if TREASURY_PRIVATE_KEY or LFRG_MINT_ADDRESS is not configured.
 */
export async function sendLfrgToPlayer(
  playerWallet: string,
  amount: number,
): Promise<string> {
  const privateKeyB58 = process.env.TREASURY_PRIVATE_KEY;
  if (!privateKeyB58) throw new Error("TREASURY_PRIVATE_KEY not configured");

  const connection = getConnection();
  const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));
  const mintPk = new PublicKey(config.lfrgMint);
  const playerPk = new PublicKey(playerWallet);

  const mintInfo = await getMint(connection, mintPk);
  const decimals = mintInfo.decimals;
  const rawAmount = BigInt(Math.floor(amount)) * BigInt(10 ** decimals);

  const sourceAta = await getAssociatedTokenAddress(mintPk, treasuryKeypair.publicKey);
  const destAta = await getAssociatedTokenAddress(mintPk, playerPk);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: treasuryKeypair.publicKey, recentBlockhash: blockhash }).add(
    createTransferCheckedInstruction(
      sourceAta,
      mintPk,
      destAta,
      treasuryKeypair.publicKey,
      rawAmount,
      decimals,
    ),
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair], {
    commitment: "confirmed",
  });

  return sig;
}

/**
 * Check whether payout infrastructure is configured.
 * Returns true only if TREASURY_PRIVATE_KEY, LFRG_MINT_ADDRESS, and SOLANA_RPC_URL are all set.
 */
export function isPayoutConfigured(): boolean {
  return !!(
    process.env.TREASURY_PRIVATE_KEY &&
    process.env.LFRG_MINT_ADDRESS &&
    process.env.SOLANA_RPC_URL
  );
}

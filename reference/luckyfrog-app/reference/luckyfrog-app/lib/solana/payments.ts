import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";
import { config } from "@/lib/config/config";

function getConnection(): Connection {
  const heliusKey = process.env.HELIUS_API_KEY;
  const rpc = heliusKey
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
    : process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  return new Connection(rpc, "confirmed");
}

export interface TransactionData {
  transaction: string;
  feePayer: string;
  qty: number;
  split: {
    market: number;
  };
}

/**
 * Builds an unsigned Token-2022 transfer for the Stash mechanic.
 * The player signs and broadcasts the transaction before the stash operation
 * verifies and records it as a `stash` transaction.
 */
export async function createStashBurnTransaction(
  playerWallet: string,
  amount: number,
): Promise<TransactionData> {
  const burnAmount = Math.floor(amount);
  if (!Number.isFinite(burnAmount) || burnAmount <= 0) {
    throw new Error("amount must be a positive integer");
  }

  const connection = getConnection();
  const mintPk = new PublicKey(config.lfrgMint);
  const payerPk = new PublicKey(playerWallet);
  const marketPk = new PublicKey(config.marketAddress);
  const mintInfo = await getMint(
    connection,
    mintPk,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  const base = BigInt(burnAmount) * BigInt(10 ** mintInfo.decimals);
  const sourceAta = await getAssociatedTokenAddress(
    mintPk,
    payerPk,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const marketAta = await getAssociatedTokenAddress(
    mintPk,
    marketPk,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const instructions: TransactionInstruction[] = [];

  try {
    await getAccount(connection, marketAta, "confirmed", TOKEN_2022_PROGRAM_ID);
  } catch (error) {
    if (
      error instanceof TokenAccountNotFoundError ||
      error instanceof TokenInvalidAccountOwnerError
    ) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          payerPk,
          marketAta,
          marketPk,
          mintPk,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    } else {
      throw error;
    }
  }

  instructions.push(
    createTransferCheckedInstruction(
      sourceAta,
      mintPk,
      marketAta,
      payerPk,
      base,
      mintInfo.decimals,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: payerPk,
    recentBlockhash: blockhash,
  }).add(...instructions);

  return {
    transaction: transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    feePayer: playerWallet,
    qty: 1,
    split: { market: burnAmount },
  };
}

/** Returns the raw token amount for a Stash transfer. */
export async function getStashAmountRaw(amount: number): Promise<bigint> {
  const connection = getConnection();
  const mintInfo = await getMint(
    connection,
    new PublicKey(config.lfrgMint),
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  return BigInt(Math.floor(amount)) * BigInt(10 ** mintInfo.decimals);
}

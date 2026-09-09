/**
 * GET /api/wallet/lfrg-balance
 *
 * Returns the on-chain $LFRG SPL token balance for the authenticated wallet.
 * Uses the same SOLANA_RPC_URL + LFRG_MINT_ADDRESS env vars as the rest of
 * the server-side Solana helpers.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { config } from "@/lib/config/config";

function getConnection(): Connection {
  const rpc =
    process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  return new Connection(rpc, "confirmed");
}

export async function GET() {
  try {
    // Auth — must have a valid session cookie
    const cookieStore = await cookies();
    const token = cookieStore.get("lfrg_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? "dev-secret-change-me",
    );
    const { payload } = await jwtVerify(token, secret);
    const wallet = payload.wallet as string;
    if (!wallet) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate mint address is configured
    const mintAddress = config.lfrgMint;
    if (
      !mintAddress ||
      mintAddress === "11111111111111111111111111111111"
    ) {
      // Mint not configured — return 0 gracefully so the UI degrades cleanly
      return NextResponse.json({ wallet, balance: 0, configured: false });
    }

    const connection = getConnection();
    const walletPk = new PublicKey(wallet);
    const mintPk = new PublicKey(mintAddress);

    // Derive the associated token account address
    const ata = await getAssociatedTokenAddress(mintPk, walletPk);

    let balance = 0;
    try {
      const account = await getAccount(connection, ata);
      // account.amount is a BigInt of raw token units (with decimals)
      // We need to fetch the mint to get decimals, or read from the account's mint info.
      // getAccount returns the raw amount — we get decimals from getMint.
      const { getMint } = await import("@solana/spl-token");
      const mintInfo = await getMint(connection, mintPk);
      const decimals = mintInfo.decimals;
      balance = Number(account.amount) / 10 ** decimals;
    } catch {
      // Token account doesn't exist yet → balance is 0
      balance = 0;
    }

    return NextResponse.json({ wallet, balance, configured: true });
  } catch (err) {
    console.error("[lfrg-balance]", err);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 },
    );
  }
}

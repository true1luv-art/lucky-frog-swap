import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { config } from "@/lib/config/config";
import { getBalanceFromCache } from "@/lib/solana/holders-cache.server";

/**
 * Fetches the total $LFRG balance held by a wallet.
 *
 * Strategy (in order):
 *  1. In-memory holders cache — built from the same Helius DAS paginated
 *     fetch the landing page uses. Instant Map lookup, zero extra network
 *     cost when the cache is warm (TTL 3 min). If the cache is cold this
 *     triggers a full DAS pagination fetch in the background and waits.
 *  2. After 5 s, if the cache fetch hasn't returned yet, falls back to a
 *     Helius DAS single-wallet lookup for just this address.
 *  3. Returns null only when both methods fail.
 */
export async function getLfrgBalance(wallet: string): Promise<number | null> {
  if (!wallet || wallet.trim().length < 32) return null;

  const heliusKey = process.env.HELIUS_API_KEY;

  // ------------------------------------------------------------------
  // 1. Holders cache (cross-reference against full holder list)
  //    Race it against a 5 s timer — if cache fetch takes too long
  //    (cold start) we fall through to the single-wallet DAS call.
  // ------------------------------------------------------------------
  try {
    const cacheResult = await Promise.race([
      getBalanceFromCache(wallet),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 5_000)),
    ]);

    if (cacheResult !== "timeout" && cacheResult !== null) {
      return cacheResult;
    }
  } catch {
    // Cache unavailable — fall through
  }

  // ------------------------------------------------------------------
  // 2. Single-wallet DAS fallback (cache timed out or was unavailable)
  // ------------------------------------------------------------------
  if (!heliusKey) return null;

  try {
    const res = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "balance-check",
          method: "getTokenAccounts",
          params: { mint: config.lfrgMint, owner: wallet, limit: 100 },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (res.ok) {
      const json = (await res.json()) as {
        result?: { token_accounts: Array<{ amount: number }> };
        error?: unknown;
      };
      if (!json.error && json.result) {
        const DECIMALS = 6;
        return json.result.token_accounts.reduce(
          (sum, a) => sum + Number(a.amount) / 10 ** DECIMALS,
          0,
        );
      }
    }
  } catch {
    // DAS also failed
  }

  return null;
}

/**
 * Fetches the native SOL balance for a wallet address.
 * Returns null on RPC error or invalid address.
 */
export async function getSolBalance(wallet: string): Promise<number | null> {
  if (!wallet || wallet.trim().length < 32) return null;

  const rpcUrl = process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "https://api.mainnet-beta.solana.com";

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const pubkey = new PublicKey(wallet);
    const lamports = await connection.getBalance(pubkey, "confirmed");
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return null;
  }
}

/**
 * Returns whether a wallet meets the minimum $LFRG hold required to play.
 * `balance` is null when the RPC lookup failed.
 */
export async function checkLfrgEligibility(
  wallet: string,
): Promise<{ eligible: boolean; balance: number | null; minHold: number }> {
  const minHold = config.minHoldLfrg;
  const balance = await getLfrgBalance(wallet);
  return {
    eligible: balance !== null && balance >= minHold,
    balance,
    minHold,
  };
}

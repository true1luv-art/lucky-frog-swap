"use server";

import { config } from "@/lib/config/config";

const CA = config.lfrgMint;

const EXCLUDED_ADDRESSES = new Set([
  "CCCvENxbKhSKML9JG6d4REes8gnt6AtN5unoHQB6ztUV",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
]);

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const PAGE_SIZE = 1000;

export interface HeliusTokenAccount {
  address: string;
  mint: string;
  owner: string;
  amount: number;
  delegated_amount: number;
  frozen: boolean;
}

interface GetTokenAccountsResponse {
  result: {
    token_accounts: HeliusTokenAccount[];
    cursor: string | null;
  };
}

export interface HoldersCache {
  /** wallet address -> human-readable balance */
  balanceByWallet: Map<string, number>;
  decimals: number;
  totalSupply: number;
  updatedAt: number;
}

// Module-level singleton shared across all requests in the same process.
let cache: HoldersCache | null = null;
let fetchPromise: Promise<HoldersCache> | null = null;

async function fetchAllTokenAccounts(
  heliusKey: string,
): Promise<{ accounts: HeliusTokenAccount[]; decimals: number; totalSupply: number }> {
  // Fetch supply + first page of token accounts in parallel
  const [supplyRes, firstPage] = await Promise.all([
    fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "supply",
        method: "getTokenSupply",
        params: [CA],
      }),
      signal: AbortSignal.timeout(15_000),
    }),
    fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "holders-page-1",
        method: "getTokenAccounts",
        params: { mint: CA, limit: PAGE_SIZE },
      }),
      signal: AbortSignal.timeout(30_000),
    }),
  ]);

  const supplyJson = (await supplyRes.json()) as {
    result: { value: { amount: string; decimals: number } };
  };
  const decimals = supplyJson.result.value.decimals;
  const totalSupply = Number(supplyJson.result.value.amount) / 10 ** decimals;

  const firstJson = (await firstPage.json()) as GetTokenAccountsResponse;
  const allAccounts: HeliusTokenAccount[] = [...(firstJson.result?.token_accounts ?? [])];
  let cursor = firstJson.result?.cursor;

  // Continue paginating if needed
  let page = 2;
  while (cursor && allAccounts.length >= PAGE_SIZE * (page - 1)) {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `holders-page-${page}`,
        method: "getTokenAccounts",
        params: { mint: CA, limit: PAGE_SIZE, cursor },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json()) as GetTokenAccountsResponse;
    const accounts = json.result?.token_accounts ?? [];
    allAccounts.push(...accounts);
    if (accounts.length < PAGE_SIZE || !json.result?.cursor) break;
    cursor = json.result.cursor;
    page++;
  }

  return { accounts: allAccounts, decimals, totalSupply };
}

/** Build a wallet->balance map from the raw token accounts. */
function buildBalanceMap(
  accounts: HeliusTokenAccount[],
  decimals: number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const account of accounts) {
    const balance = Number(account.amount) / 10 ** decimals;
    if (
      balance <= 0 ||
      EXCLUDED_ADDRESSES.has(account.owner) ||
      EXCLUDED_ADDRESSES.has(account.address)
    ) continue;
    map.set(account.owner, (map.get(account.owner) ?? 0) + balance);
  }
  return map;
}

/**
 * Returns the in-memory holders cache, refreshing it in the background when
 * stale. Safe to call concurrently — only one fetch runs at a time.
 */
export async function getHoldersCache(): Promise<HoldersCache | null> {
  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) return null;

  const now = Date.now();
  if (cache && now - cache.updatedAt < CACHE_TTL) return cache;

  // Deduplicate concurrent refreshes
  if (!fetchPromise) {
    fetchPromise = fetchAllTokenAccounts(heliusKey)
      .then(({ accounts, decimals, totalSupply }) => {
        const result: HoldersCache = {
          balanceByWallet: buildBalanceMap(accounts, decimals),
          decimals,
          totalSupply,
          updatedAt: Date.now(),
        };
        cache = result;
        fetchPromise = null;
        return result;
      })
      .catch((err) => {
        fetchPromise = null;
        throw err;
      });
  }

  return fetchPromise;
}

/**
 * Look up a single wallet's balance from the cache.
 * Returns null if the cache is empty or the wallet isn't in it.
 */
export async function getBalanceFromCache(wallet: string): Promise<number | null> {
  try {
    const c = await getHoldersCache();
    if (!c) return null;
    return c.balanceByWallet.get(wallet) ?? 0;
  } catch {
    return null;
  }
}

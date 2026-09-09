/**
 * lib/modules/price/lfrgPrice.server.ts
 *
 * Fetches the live $LFRG USD price from the Uniswap V2-style LP pair contract
 * on Robinhood Chain (chainId 4663) using a raw JSON-RPC eth_call.
 *
 * No ethers / viem — just one fetch call to the configured RPC.
 *
 * The pair contract exposes:
 *   getReserves() → (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)
 *
 * Price is derived from the ratio of the two reserves.
 * Which side is LFRG is configured via LFRG_PAIR_TOKEN0_IS_LFRG env var.
 *
 * SERVER-ONLY — never import from 'use client' files.
 */

import { config } from "@/lib/config/config";

// ---------------------------------------------------------------------------
// ABI-encode getReserves() selector: keccak256("getReserves()")[0:4] = 0x0902f1ac
// ---------------------------------------------------------------------------
const GET_RESERVES_SELECTOR = "0x0902f1ac";

/** getReserves() return type: (uint112, uint112, uint32) — 3 × 32-byte words */
function decodeReserves(hex: string): [bigint, bigint] {
  // Strip 0x prefix
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  const reserve0 = BigInt("0x" + data.slice(0,  64));
  const reserve1 = BigInt("0x" + data.slice(64, 128));
  return [reserve0, reserve1];
}

export interface LfrgPriceResult {
  /** USD price of 1 LFRG */
  priceUsd: number;
  /** LFRG tokens required to pay exactly $2 USD at the current price */
  tokensFor2Usd: number;
  /** Unix ms when this was fetched */
  fetchedAt: number;
  /** Whether a live price was available (false = pair not configured yet) */
  live: boolean;
}

const FALLBACK_PRICE_USD = 0.001; // used only when pair address is not yet set

/**
 * Returns the live LFRG USD price from the pair contract.
 * Falls back gracefully when LFRG_PAIR_ADDRESS is not configured.
 */
export async function fetchLfrgPrice(): Promise<LfrgPriceResult> {
  const { pairAddress, pairToken0IsLfrg, rpcUrl } = config.blockchain.robinhood;
  const decimals = config.blockchain.robinhood.decimals; // both tokens assumed 18 decimals

  // If pair address is not configured, return fallback
  if (!pairAddress) {
    const priceUsd     = FALLBACK_PRICE_USD;
    const tokensFor2Usd = Math.ceil(2 / priceUsd);
    return { priceUsd, tokensFor2Usd, fetchedAt: Date.now(), live: false };
  }

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id:      1,
    method:  "eth_call",
    params:  [
      { to: pairAddress, data: GET_RESERVES_SELECTOR },
      "latest",
    ],
  });

  const res  = await fetch(rpcUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body,
    next:    { revalidate: 60 },  // Next.js fetch cache — revalidate every 60s
  });

  if (!res.ok) throw new Error(`RPC fetch failed: ${res.status}`);

  const json = await res.json() as { result?: string; error?: { message: string } };
  if (json.error)   throw new Error(`RPC error: ${json.error.message}`);
  if (!json.result) throw new Error("RPC returned no result");

  const [reserve0, reserve1] = decodeReserves(json.result);

  // Both reserves are in their token's base units (18 decimals assumed equal)
  const lfrgReserve   = pairToken0IsLfrg ? reserve0 : reserve1;
  const stableReserve = pairToken0IsLfrg ? reserve1 : reserve0;

  if (lfrgReserve === 0n) throw new Error("LFRG reserve is zero — pool may be empty");

  // price = stableReserve / lfrgReserve (both 18-decimal, ratio is dimensionless)
  const priceUsd = Number(stableReserve) / Number(lfrgReserve);

  const tokensFor2Usd = Math.ceil(2 / priceUsd);

  return { priceUsd, tokensFor2Usd, fetchedAt: Date.now(), live: true };
}

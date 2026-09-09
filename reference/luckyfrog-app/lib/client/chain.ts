"use client";

/**
 * lib/client/chain.ts
 *
 * Reads NEXT_PUBLIC_* env vars and exports resolved runtime flags for use
 * in client-side code (login UI, wallet adapters, HUD overlays, etc.).
 *
 * CLIENT-SAFE — only reads NEXT_PUBLIC_ prefixed vars which are baked into
 * the browser bundle at build time. Defaults to "solana" when env vars are absent.
 */

export type SupportedChain = "robinhood" | "solana" | "hive";

const raw = (process.env.NEXT_PUBLIC_CHAIN ?? "robinhood").toLowerCase();

export const activeChain: SupportedChain =
  raw === "hive"   ? "hive"   :
  raw === "solana" ? "solana" :
  "robinhood"; // default — Robinhood Chain only

/**
 * Master switch for the withdrawal feature.
 * Set NEXT_PUBLIC_WALLET_ENABLED=true to open withdrawals.
 * Any other value (or absent) disables them — API returns 503, UI shows notice.
 */
export const walletEnabled =
  process.env.NEXT_PUBLIC_WALLET_ENABLED === "true";

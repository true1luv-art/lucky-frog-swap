/**
 * server/luckfrog-smart-contract-test/config.ts
 *
 * The ONLY place in the consolidated smart-contract runtime that reads
 * process.env. Everything downstream imports the resolved constants from here.
 *
 * Wallet: uses MARKET_TEST_ADDRESS / MARKET_TEST_PRIVATE_KEY (the staging
 * market/escrow wallet). RPC + Enhanced Transactions run through Helius.
 */

// Side-effect import — loads .env files before any process.env read below.
import "./env";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`[luckfrog-sc] Missing required env var: ${name}`);
  }
  return val;
}

// ---------------------------------------------------------------------------
// Required env
// ---------------------------------------------------------------------------

export const HELIUS_API_KEY = requireEnv("HELIUS_API_KEY");
export const LFRG_MINT = requireEnv("LFRG_MINT_ADDRESS");
export const MARKET_TEST_ADDRESS = requireEnv("MARKET_TEST_ADDRESS");
export const MARKET_TEST_PRIVATE_KEY = requireEnv("MARKET_TEST_PRIVATE_KEY");

// ---------------------------------------------------------------------------
// Derived RPC endpoints
// ---------------------------------------------------------------------------

/** Helius RPC HTTP endpoint (falls back to SOLANA_RPC_URL when provided). */
export const RPC_HTTP =
  process.env.SOLANA_RPC_URL ??
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

/** WebSocket endpoint derived from the HTTP endpoint. */
export const RPC_WSS = RPC_HTTP.replace(/^https/, "wss").replace(/^http/, "ws");

/** Helius Enhanced Transactions API (parses raw txs into token transfers). */
export const HELIUS_ENHANCED_URL = `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`;

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Fallback SPL decimals if getMint fails (LFRG standard is 6). */
export const DEFAULT_DECIMALS = 6;

/** How many recent signatures to inspect on each account-change notification. */
export const SIGNATURES_TO_CHECK = 5;

// WebSocket reconnect / heartbeat settings
export const RECONNECT_BASE_MS = 2_000;
export const RECONNECT_MAX_MS = 30_000;
export const HEARTBEAT_INTERVAL_MS = 20_000;

/** Tag used for all runtime logs. */
export const LOG_TAG = "luckfrog-sc";

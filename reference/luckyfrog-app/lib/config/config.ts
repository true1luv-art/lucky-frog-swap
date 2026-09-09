/**
 * Central configuration — the ONLY place that reads process.env.
 * All other modules must import from here.
 * Server-only: never import this from a 'use client' file.
 *
 * Env var naming follows boom-miner's generalized pattern:
 *   CONTRACT_ADDRESS  — token/program/contract address (chain-agnostic)
 *   TREASURY_ADDRESS  — public treasury wallet address (chain-agnostic)
 *   TREASURY_KEY      — treasury private key (server-only, chain-agnostic)
 *   NEXT_PUBLIC_CHAIN — active chain: solana | hive
 *   NEXT_PUBLIC_WALLET_ENABLED — "true" to open withdrawals (any other = disabled)
 *
 * Legacy farm-specific keys (HFARM_*) are accepted as fallbacks so existing
 * deployments that have not yet migrated their env vars continue to work.
 */

export type SupportedChain = "robinhood" | "solana" | "hive";

/**
 * Parses an env var that must be a positive integer.
 * Returns `fallback` when the var is absent or empty.
 * Throws a descriptive error when set but invalid, preventing silent NaN.
 */
function requirePositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Config error: ${name}="${raw}" is not a valid positive integer`);
  }
  return n;
}

function resolveChain(): SupportedChain {
  // NEXT_PUBLIC_CHAIN is readable in both server and client contexts.
  // CHAIN (no prefix) is the server-only fallback — set only one.
  const raw = (
    process.env.NEXT_PUBLIC_CHAIN ??
    process.env.CHAIN ??
    "robinhood"
  ).toLowerCase();

  if (raw === "hive")   return "hive";
  if (raw === "solana") return "solana";
  return "robinhood"; // default
}

/** Token display name readable on both client and server. Defaults to "$LFRG". */
export const TOKEN_NAME = process.env.NEXT_PUBLIC_TOKEN_NAME ?? process.env.ROBINHOOD_TOKEN_NAME ?? "$LFRG";

export const config = {
  mongoUri:  process.env.MONGODB_URI!,
  jwtSecret: process.env.JWT_SECRET ?? "changeme-dev-secret",

  // ---------------------------------------------------------------------------
  // Withdrawal worker tuning (not env-configurable — matches boom-miner)
  // ---------------------------------------------------------------------------
  withdrawal: {
    workerPollMs: 5_000,
    maxRetries:   8,
  },

  // ---------------------------------------------------------------------------
  // Multi-chain blockchain bridge
  //
  // Shared top-level keys (boom-miner pattern):
  //   CONTRACT_ADDRESS  → tokenAddress / mint / tokenSymbol per chain
  //   TREASURY_ADDRESS  → treasuryAddress / treasuryAccount per chain
  //   TREASURY_KEY      → treasuryPrivateKey / treasuryKey per chain
  //
  // Chain-specific keys are only needed when the default doesn't apply.
  // ---------------------------------------------------------------------------
  blockchain: {
    chain: resolveChain(),

    // Generalised top-level keys used by all chains.
    contractAddress: process.env.CONTRACT_ADDRESS ?? "",
    treasuryAddress: process.env.TREASURY_ADDRESS ?? "",
    treasuryKey:     process.env.TREASURY_KEY ?? "",

    // ---- Robinhood Chain (EVM, chain ID 4663) ----------------------------------
    robinhood: {
      /** JSON-RPC endpoint for Robinhood Chain mainnet */
      rpcUrl:      process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com/",
      /**
       * Uniswap V2-style LP pair contract address for LFRG/stablecoin on
       * Robinhood Chain. Used to compute live USD price via getReserves().
       * Set LFRG_PAIR_ADDRESS in your env vars.
       * Set LFRG_PAIR_TOKEN0_IS_LFRG=true  if token0 is LFRG, false if token1 is LFRG.
       */
      pairAddress:      process.env.LFRG_PAIR_ADDRESS ?? "",
      pairToken0IsLfrg: (process.env.LFRG_PAIR_TOKEN0_IS_LFRG ?? "true") === "true",
      chainId:     requirePositiveInt("ROBINHOOD_CHAIN_ID", process.env.ROBINHOOD_CHAIN_ID, 4663),
      chainIdHex:  "0x1237",
      /** ERC-20 game token contract address */
      tokenAddress: process.env.CONTRACT_ADDRESS ?? "",
      /** Display name of the game token, e.g. "$LFRG". Shown in UI. */
      tokenName:   process.env.ROBINHOOD_TOKEN_NAME ?? "$LFRG",
      decimals:    requirePositiveInt("ROBINHOOD_TOKEN_DECIMALS", process.env.ROBINHOOD_TOKEN_DECIMALS, 18),
      explorerUrl: "https://robinhoodchain.blockscout.com",
      /** Treasury EOA public address */
      treasuryAddress:    process.env.TREASURY_ADDRESS ?? "",
      /** Treasury private key — SERVER-ONLY */
      treasuryPrivateKey: process.env.TREASURY_KEY ?? "",
    },

    // ---- EVM (generic — used by the on-chain transfer worker) -----------------
    evm: {
      /** JSON-RPC endpoint for the active EVM chain */
      rpcUrl:       process.env.EVM_RPC_URL ?? process.env.HFARM_RPC_URL ?? "",
      chainId:      requirePositiveInt("EVM_CHAIN_ID", process.env.EVM_CHAIN_ID, 1),
      /** ERC-20 token contract address */
      tokenAddress: process.env.CONTRACT_ADDRESS ?? process.env.HFARM_TOKEN_ADDRESS ?? "",
      decimals:     requirePositiveInt("EVM_TOKEN_DECIMALS", process.env.EVM_TOKEN_DECIMALS, 18),
      /** Treasury EOA public address */
      treasuryAddress:    process.env.TREASURY_ADDRESS ?? process.env.HFARM_TREASURY_ADDRESS ?? "",
      /** Treasury private key — SERVER-ONLY */
      treasuryPrivateKey: process.env.TREASURY_KEY ?? process.env.TREASURY_PRIVATE_KEY ?? "",
    },

    // ---- Solana ----------------------------------------------------------------
    solana: {
      /** Public JSON-RPC endpoint — shown in browser deposit flow, no secrets. */
      rpcUrl:       process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
      /** Helius API key — SERVER-ONLY for reliable payout/verify RPC. */
      heliusApiKey: process.env.HELIUS_API_KEY ?? "",
      /** SPL/Token-2022 mint address. */
      mint:         process.env.CONTRACT_ADDRESS ?? "",
      treasuryAddress: process.env.TREASURY_ADDRESS ?? "",
      treasuryKey:     process.env.TREASURY_KEY ?? "",
    },

    // ---- Hive ------------------------------------------------------------------
    hive: {
      rpcNodes:     (process.env.HIVE_RPC_NODES ?? "https://api.hive.blog")
                      .split(",").map((s) => s.trim()).filter(Boolean),
      engineRpcUrl: process.env.HIVE_ENGINE_RPC_URL ?? "https://api.hive-engine.com/rpc",
      engineId:     process.env.HIVE_ENGINE_ID ?? "ssc-mainnet-hive",
      /** Hive-Engine token symbol — falls back to CONTRACT_ADDRESS. */
      tokenSymbol:  process.env.HIVE_TOKEN_SYMBOL ?? process.env.CONTRACT_ADDRESS ?? "",
      precision:    Number(process.env.HIVE_TOKEN_PRECISION ?? 8),
      treasuryAccount: process.env.TREASURY_ADDRESS ?? "",
      treasuryKey:     process.env.TREASURY_KEY ?? "",
    },
  },
} as const;

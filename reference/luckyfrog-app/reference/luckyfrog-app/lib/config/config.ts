/**
 * Central configuration — the ONLY place that reads process.env.
 * All other modules must import from here.
 */
export const config = {
  mongoUri: process.env.MONGODB_URI!,
  jwtSecret: process.env.JWT_SECRET ?? "changeme-dev-secret",

  // Which environment this deployment represents: "staging" | "production" | "development".
  // Set APP_ENV explicitly per environment (staging = "staging", prod = "production").
  // This is ONLY for cosmetic/operational concerns (banners, logging) — never branch
  // game logic on it. Falls back to Vercel's automatic VERCEL_ENV, then "development".
  appEnv:
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.APP_ENV ??
    process.env.VERCEL_ENV ??
    "development",

  // Minimum $LFRG a wallet must hold to access the game.
  // Set per environment: staging = 1000000, production = 1000.
  // This is the SERVER source of truth — the gate is enforced with this value.
  minHoldLfrg: Number(process.env.MIN_HOLD_LFRG ?? 1000),

  // Solana wallet addresses (populated in Phase 3)
  treasuryWallet: process.env.TREASURY_WALLET ?? "",
  treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY ?? "",
  marketAddress: process.env.MARKET_ADDRESS ?? "",
  // Test marketplace wallet — receives egg-purchase payments in the test flow
  // and refunds them back to the buyer once the egg is granted. The private key
  // never leaves the server; it signs the refund transfer.
  marketTestAddress: process.env.MARKET_TEST_ADDRESS ?? "",
  marketTestPrivateKey: process.env.MARKET_TEST_PRIVATE_KEY ?? "",
  leaderboardWallet: process.env.LEADERBOARD_WALLET ?? "",
  solanaProgramId: process.env.SOLANA_PROGRAM_ID ?? "",

  // $LFRG SPL mint address (Pump.fun)
  // Get this from your Pump Fun token page or https://solscan.io
  // Should be a 44-character base58 string like "EPjFWaLb3odcccccccccccccccccccccccccccccc"
  lfrgMint: process.env.LFRG_MINT_ADDRESS ?? "11111111111111111111111111111111",

  // 100% of chest purchase goes to MARKET_ADDRESS.
  // The daily settlement cron splits it to treasury + leaderboard.
  purchaseSplit: {
    market: 1.0,
  },
} as const;

/** True when this deployment is the staging/test environment. */
export const isStaging = config.appEnv === "staging" || config.appEnv === "preview";
/** True when this deployment is production. */
export const isProduction = config.appEnv === "production";

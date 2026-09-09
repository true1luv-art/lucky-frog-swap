/**
 * server/farm-smart-contract/index.ts
 *
 * VPS sidecar process entry point.
 *
 * Boot sequence:
 *   1. Load .env (dotenv) — reads the same vars as Next.js.
 *   2. Connect to MongoDB.
 *   3. Start the transaction worker — drains transactions_pending every 5 s.
 *
 * The frontend creates a pending row for every player-initiated transaction
 * (deposit, withdrawal, marketplace purchase). The transaction worker picks
 * them up and processes them. Clients learn about outcomes by polling
 * GET /api/transactions.
 *
 * Run via:
 *   pnpm run server:start    (production — tsx)
 *   pnpm run server:dev      (development — tsx watch)
 *
 * Required environment variables (shared with Next.js):
 *   MONGODB_URI
 *   JWT_SECRET
 *   CONTRACT_ADDRESS      (or legacy fallback: HFARM_TOKEN_ADDRESS)
 *   TREASURY_ADDRESS      (or legacy fallback: HFARM_TREASURY_ADDRESS)
 *   TREASURY_KEY          (or legacy fallback: TREASURY_PRIVATE_KEY)
 */

import "dotenv/config";

import { connectDatabase }                                 from "../../lib/config/database";
import { log }                                             from "./lib/logger";
import { startTransactionWorker, stopTransactionWorker } from "./workers/transaction-worker";

async function main(): Promise<void> {
  log.info("server", "=== HFARM — VPS server starting ===");

  await connectDatabase();

  startTransactionWorker();

  log.info("server", "=== All systems running ===");
}

function shutdown(signal: string): void {
  log.info("server", `Received ${signal} — shutting down`);
  stopTransactionWorker();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("uncaughtException",  (err) => log.error("server", "Uncaught exception",  err));
process.on("unhandledRejection", (err) => log.error("server", "Unhandled rejection", err));

main().catch((err) => {
  log.error("server", "Fatal startup error", err);
  process.exit(1);
});

/**
 * server/luckfrog-smart-contract-test/index.ts
 *
 * Entrypoint for the consolidated LuckyFrog smart-contract runtime.
 *
 * Phase 4 (marketplace flow + payout consumer):
 *   - registers the marketplace-buy flow (`transaction`) with the router,
 *   - boots the outbound payout consumer (seller net / buyer refund drain loop),
 *   - boots the Helius WebSocket watcher against MARKET_TEST_ADDRESS and routes
 *     every inbound $LFRG transfer through the memo router.
 *
 * On a `tm_purchase-<hash>` deposit the marketplace-buy flow settles the sale
 * inline (transfer asset + log + enqueue seller payout, fee kept, no refund).
 * The consumer drains the outbound payout out of the escrow wallet.
 *
 * NOTE: egg-buy flow removed in Phase 3 cleanup (eggs removed from game).
 *
 * Run:
 *   pnpm server:luckfrog-sc
 */

// Side-effect import first — loads env before any config read.
import "./env";
import { log } from "./lib/logger";
import { startWatcher } from "./watcher/ws-listener";
import { startIngestConsumer } from "./watcher/ingest-consumer";
import { registerMarketplaceBuyFlow } from "./flows/marketplace-buy";
import { startConsumer } from "./settlement/consumer";
import { enqueueInboundTransfer } from "@/lib/modules/transactions-pending/repository.server";
import type { InboundTransfer } from "./watcher/tx-parser";

function shutdown(signal: string): void {
  log.info(`${signal} received — shutting down.`);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/**
 * The watcher's handler: PERSIST ONLY. Every detected $LFRG deposit is written
 * to the durable `transactions_pending` queue and settled later by the ingest consumer.
 * This decouples chain-detection from settlement, so a crash between the two
 * never loses a deposit (idempotent on the unique signature).
 */
async function enqueueTransfer(transfer: InboundTransfer): Promise<void> {
  const created = await enqueueInboundTransfer({
    signature: transfer.signature,
    sender: transfer.sender,
    tokenAmount: transfer.tokenAmount,
    rawAmount: transfer.rawAmount,
    memo: transfer.memo,
    blockTime: transfer.blockTime,
  });
  log.info(
    `Enqueued inbound transfer ${transfer.signature} ` +
      `(${created ? "new" : "already queued"}).`,
  );
}

async function main(): Promise<void> {
  // Register settlement flows with the router before the ingest consumer starts
  // draining the queue through it.
  registerMarketplaceBuyFlow();

  // Boot the outbound payout drain loop (seller net / buyer refund).
  await startConsumer();

  // Boot the inbound ingest consumer — drains the durable `transactions_pending` queue
  // and routes each row to its registered settlement flow.
  await startIngestConsumer();

  // Boot the inbound watcher — records each detected transfer into the durable
  // queue (no inline settlement).
  await startWatcher(enqueueTransfer);
}

main().catch((err) => {
  log.error("Fatal error:", err);
  process.exit(1);
});

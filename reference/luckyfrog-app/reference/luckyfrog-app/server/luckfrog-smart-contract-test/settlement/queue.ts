/**
 * server/luckfrog-smart-contract-test/settlement/queue.ts
 *
 * Runtime-local facade over the durable settlement queue. The Mongo model and
 * repository now live in `lib/modules/transactions-pending/` — the unified work
 * queue that holds BOTH inbound deposit rows and outbound payout rows in a
 * single `transactions_pending` collection (the old `marketplace-settlement`
 * module has been merged in). This module re-exports just the operations the
 * consolidated runtime needs so every runtime file imports the queue through a
 * single local surface.
 *
 * The queue is crash-safe (MongoDB-backed) and idempotent on the unique row
 * `signature`:
 *   - inbound  rows use the on-chain purchase signature,
 *   - outbound payout rows use the synthetic `<kind>:<refSignature>` key.
 *
 * The runtime enqueues OUTBOUND payout jobs (seller net / buyer refund) from
 * `settleOnChainPurchase` and drains them in `consumer.ts`.
 */

export {
  enqueuePayoutJob,
  listPendingOldestFirst,
  completeJob,
  failJob,
  countJobsByStatus,
} from "@/lib/modules/transactions-pending/repository.server";

export type { EnqueuePayoutInput } from "@/lib/modules/transactions-pending/repository.server";

export type {
  IInboundTransaction as IMarketplaceSettlementJob,
  SettlementKind,
  InboundTxStatus as SettlementJobStatus,
} from "@/lib/modules/transactions-pending/types.server";

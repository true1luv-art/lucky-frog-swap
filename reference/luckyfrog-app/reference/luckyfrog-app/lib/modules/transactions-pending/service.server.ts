/**
 * lib/modules/transactions-pending/service.server.ts
 *
 * Public API for the transactions-pending domain.
 * All DB access is delegated to repository.server.ts.
 *
 * External callers (routes, lib/services files) must import from here —
 * never from repository.server.ts directly.
 */

export {
  enqueueInboundTransfer,
  enqueuePayoutJob,
  listPendingOldestFirst,
  completeJob,
  failJob,
  countJobsByStatus,
} from "./repository.server";

export type {
  EnqueueInboundInput,
  EnqueuePayoutInput,
} from "./repository.server";

export type {
  IInboundTransaction,
  InboundTxStatus,
} from "./types.server";

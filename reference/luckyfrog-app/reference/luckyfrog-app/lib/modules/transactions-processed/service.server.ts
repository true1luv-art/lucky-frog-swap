/**
 * lib/modules/transactions-processed/service.server.ts
 *
 * Public API for the transactions-processed domain.
 * All DB access is delegated to repository.server.ts.
 *
 * External callers (routes, lib/services files) must import from here —
 * never from repository.server.ts directly.
 */

export {
  findProcessedTransaction,
  insertProcessedTransaction,
  isTransactionProcessed,
} from "./repository.server";

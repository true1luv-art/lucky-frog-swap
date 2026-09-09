/**
 * server/luckfrog-smart-contract-test/router/handle-transaction.ts
 *
 * The CONSUMER-side router — the LuckyFrog analogue of TerraCore's
 * `handleTransaction`. It receives a normalized {@link InboundTransfer} from the
 * watcher, classifies its memo, and dispatches to the settlement flow
 * registered for that kind.
 *
 * Separation of concerns:
 *   - Signature-level dedup is the WATCHER's job (ws-listener already guards
 *     each signature via `dedup.ts`), so the router does NOT re-check it here.
 *   - Durable, per-action idempotency (inserting `transactions_processed`
 *     BEFORE any grant/transfer) belongs to the individual flow handlers added
 *     in Phases 4–5, because it must be atomic with the side effect.
 *
 * In Phase 2 no handlers are registered yet, so the router is observe-only: it
 * classifies and logs. Registering handlers later turns on real settlement
 * without touching the watcher.
 */
import type { InboundTransfer } from "../watcher/tx-parser";
import { classifyMemo, type RouteDecision, type RouteKind } from "./memo";
import { log } from "../lib/logger";

/** Context passed to a settlement flow handler. */
export interface TransferContext {
  transfer: InboundTransfer;
  decision: RouteDecision;
}

/**
 * Outcome of routing a single inbound transfer — consumed by the durable
 * ingest consumer to decide the row's fate in the `transactions_pending` queue:
 *   - "settled" — finished successfully (or already-processed). Delete the row.
 *   - "dropped" — terminal rejection (unroutable, spoofed, listing gone, etc.).
 *                 Nothing more to do; delete the row.
 *   - "retry"   — transient failure (locked listing, DB/config blip). Keep the
 *                 row and re-attempt on the next drain (dead-letter after N).
 */
export type RouteOutcome = "settled" | "dropped" | "retry";

/** A settlement flow: reacts to one classified transfer and reports an outcome. */
export type TransferHandler = (ctx: TransferContext) => Promise<RouteOutcome>;

/** Registry of flow handlers keyed by route kind. */
const handlers = new Map<RouteKind, TransferHandler>();

/**
 * Registers the settlement flow for a route kind. Called at boot by the
 * egg-buy / marketplace-buy flows (Phases 4–5). Re-registering overwrites.
 */
export function registerHandler(kind: RouteKind, handler: TransferHandler): void {
  handlers.set(kind, handler);
}

/** Removes all registered handlers — primarily for tests. */
export function resetHandlers(): void {
  handlers.clear();
}

/**
 * Routes a single inbound transfer to its settlement flow and reports a
 * {@link RouteOutcome} back to the durable ingest consumer.
 *
 * Never throws: a handler failure is caught and reported as "retry" so one bad
 * transfer cannot take down the drain loop. Flows own their own refund
 * semantics; the queue owns durability + back-off.
 *
 *   - unknown memo / no handler → "dropped" (nothing can ever settle it).
 *   - handler threw unexpectedly → "retry" (transient; re-attempt next drain).
 */
export async function handleTransaction(
  transfer: InboundTransfer,
): Promise<RouteOutcome> {
  const decision = classifyMemo(transfer.memo);

  log.info(
    `Routing sig ${transfer.signature}: kind=${decision.kind} ` +
      `amount=${transfer.tokenAmount} from=${transfer.sender} ` +
      `memo=${transfer.memo ?? "<none>"}`,
  );

  if (decision.kind === "unknown") {
    log.warn(
      `Unroutable transfer (sig ${transfer.signature}) — no recognized action ` +
        `in memo. Dropping (no settlement possible).`,
    );
    return "dropped";
  }

  const handler = handlers.get(decision.kind);
  if (!handler) {
    log.warn(
      `No handler registered for "${decision.kind}" (sig ${transfer.signature}) ` +
        `— dropping.`,
    );
    return "dropped";
  }

  try {
    return await handler({ transfer, decision });
  } catch (err) {
    log.error(
      `Handler for "${decision.kind}" threw (sig ${transfer.signature}):`,
      err,
    );
    return "retry";
  }
}

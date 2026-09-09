/**
 * server/luckfrog-smart-contract-test/watcher/dedup.ts
 *
 * Signature-based idempotency for the watcher — mirrors the seen/in-flight
 * contract of TerraCore's `hashes.js` (checkHash / storeHash), but keyed on the
 * on-chain **transaction signature** rather than the client-supplied memo.
 *
 * The memo is routing-only and attacker-controlled, so it must NEVER be the
 * dedup key. The signature is assigned by the cluster and is globally unique.
 *
 * This set is in-memory (process-lifetime) and is now only a FAST-PATH: it stops
 * the producer re-fetching/parsing a signature it already handled this process.
 * Durability no longer depends on it — the watcher persists every transfer into
 * the `transactions_pending` queue (UNIQUE signature index), and the settlement services
 * write `transactions_processed` before any grant, so a restart never replays a
 * grant/payout even though this set is empty on boot.
 */

/** Signatures fully handled — the producer skips re-parsing these. */
const doneSignatures = new Set<string>();

/**
 * Signatures currently being parsed (async in-flight). Added SYNCHRONOUSLY
 * before any await so a second notification arriving mid-parse cannot re-queue
 * the same signature.
 */
const inFlightSignatures = new Set<string>();

/** True if this signature was already fully handled. */
export function isDone(signature: string): boolean {
  return doneSignatures.has(signature);
}

/** True if this signature is currently being parsed. */
export function isInFlight(signature: string): boolean {
  return inFlightSignatures.has(signature);
}

/** True if the signature is neither done nor in-flight (safe to pick up). */
export function isNew(signature: string): boolean {
  return !doneSignatures.has(signature) && !inFlightSignatures.has(signature);
}

/** Mark a signature as in-flight (call synchronously, before awaiting). */
export function markInFlight(signature: string): void {
  inFlightSignatures.add(signature);
}

/** Clear the in-flight marker (call in a finally block after parsing). */
export function clearInFlight(signature: string): void {
  inFlightSignatures.delete(signature);
}

/** Mark a signature as fully handled. */
export function markDone(signature: string): void {
  inFlightSignatures.delete(signature);
  doneSignatures.add(signature);
}

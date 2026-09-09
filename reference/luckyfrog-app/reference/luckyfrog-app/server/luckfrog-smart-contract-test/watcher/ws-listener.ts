/**
 * server/luckfrog-smart-contract-test/watcher/ws-listener.ts
 *
 * The PRODUCER half of the runtime: a resilient Helius WebSocket listener that
 * subscribes to the market wallet's ATA and, on every accountNotification,
 * fetches recent signatures, parses the new ones, dedups on signature, and
 * hands each normalized InboundTransfer to a caller-supplied handler.
 *
 * In the durable-queue runtime that handler is `enqueueInboundTransfer`, which
 * PERSISTS the transfer into the `transactions_pending` collection; the inbound ingest
 * consumer settles it later. The listener never reacts to transfers itself (no
 * grants, no refunds, no settlement).
 *
 * The in-memory dedup here is a fast-path only — it avoids re-fetching/parsing
 * signatures already handled this process. The authoritative idempotency guard
 * is the UNIQUE `signature` index on the `transactions_pending` queue, so a restart (or
 * a re-scan of the same window) never double-enqueues. Ported from
 * server/test-market/monitor.ts.
 */
import WebSocket from "ws";
import { PublicKey } from "@solana/web3.js";
import {
  RPC_WSS,
  RPC_HTTP,
  LFRG_MINT,
  MARKET_TEST_ADDRESS,
  SIGNATURES_TO_CHECK,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  HEARTBEAT_INTERVAL_MS,
} from "../config";
import { log } from "../lib/logger";
import {
  getConnection,
  getEscrowKeypair,
  getMarketAta,
  getMintDecimals,
} from "../settlement/escrow";
import {
  fetchParsedTransaction,
  extractInboundTransfers,
  type InboundTransfer,
} from "./tx-parser";
import { isNew, markInFlight, clearInFlight, markDone } from "./dedup";

/** Handler invoked once per inbound $LFRG transfer into the market wallet. */
export type InboundTransferHandler = (
  transfer: InboundTransfer,
) => void | Promise<void>;

/**
 * Cursor: the newest signature seen on the ATA. getSignaturesForAddress({ until })
 * returns only signatures NEWER than this, so ATA history is never re-processed.
 * Initialised to the current tip at startup (stored, never handled).
 */
let lastKnownSig: string | undefined;

/**
 * PRODUCER step — fetch recent signatures, parse the new ones, and dispatch
 * each inbound transfer to the handler. Read-only w.r.t. the chain.
 */
async function processAccountChange(
  marketAta: PublicKey,
  rawMultiplier: bigint,
  onTransfer: InboundTransferHandler,
): Promise<void> {
  const connection = getConnection();

  let sigs: { signature: string }[];
  try {
    sigs = await connection.getSignaturesForAddress(marketAta, {
      limit: SIGNATURES_TO_CHECK,
      until: lastKnownSig,
    });
  } catch (err) {
    log.error("Failed to fetch signatures:", err);
    return;
  }

  if (sigs.length === 0) return;

  // Advance the cursor to the newest signature in this batch.
  lastKnownSig = sigs[0].signature;

  const newSigs = sigs.filter((s) => isNew(s.signature));
  if (newSigs.length === 0) return;

  // Mark all as in-flight SYNCHRONOUSLY before any await — closes the race
  // where two notifications arrive before the first parse completes.
  for (const { signature } of newSigs) markInFlight(signature);

  await Promise.all(
    newSigs.map(async ({ signature }) => {
      try {
        const parsed = await fetchParsedTransaction(signature);
        if (!parsed) {
          markDone(signature);
          return;
        }

        const transfers = extractInboundTransfers(parsed, rawMultiplier);
        if (transfers.length === 0) {
          markDone(signature);
          return;
        }

        for (const transfer of transfers) {
          try {
            await onTransfer(transfer);
          } catch (err) {
            log.error(
              `Handler threw for transfer from ${transfer.sender} (sig: ${signature}):`,
              err,
            );
          }
        }

        markDone(signature);
      } catch (err) {
        // Parsing failed — clear in-flight so a later notification can retry.
        clearInFlight(signature);
        log.error(`Failed to process signature ${signature}:`, err);
      }
    }),
  );
}

/**
 * Boots the watcher: verifies the escrow wallet, resolves the market ATA and
 * mint decimals, initialises the cursor, then maintains a self-healing
 * WebSocket subscription. Every inbound transfer is passed to `onTransfer`.
 */
export async function startWatcher(
  onTransfer: InboundTransferHandler,
): Promise<void> {
  const connection = getConnection();

  // Verify the escrow keypair matches MARKET_TEST_ADDRESS before any RPC call.
  const escrow = getEscrowKeypair();

  log.info(`RPC endpoint   : ${RPC_HTTP}`);
  log.info(`LFRG mint      : ${LFRG_MINT}`);
  log.info(`Market wallet  : ${MARKET_TEST_ADDRESS}`);
  log.info(`Escrow signer  : ${escrow.publicKey.toBase58()}`);

  const decimals = await getMintDecimals();
  log.info(`Mint decimals  : ${decimals}`);

  const rawMultiplier = BigInt(10 ** decimals);
  const marketAta = await getMarketAta();
  log.info(`Monitoring ATA : ${marketAta.toBase58()}`);

  // Initialise the cursor BEFORE opening the socket so the first real
  // notification is processed rather than consumed by cursor setup.
  try {
    const tip = await connection.getSignaturesForAddress(marketAta, { limit: 1 });
    lastKnownSig = tip[0]?.signature;
    log.info(`Cursor initialised — ATA tip: ${lastKnownSig ?? "no history"}`);
  } catch (err) {
    log.error("Failed to initialise cursor:", err);
  }

  let retryCount = 0;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let isAlive = false;

  function connect(): void {
    log.info("Connecting to Helius WebSocket...");

    const ws = new WebSocket(RPC_WSS);
    let subscriptionId: number | null = null;

    ws.on("open", () => {
      log.info("WebSocket connected.");
      retryCount = 0;
      isAlive = true;

      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "accountSubscribe",
          params: [
            marketAta.toBase58(),
            { encoding: "base64", commitment: "confirmed" },
          ],
        }),
      );

      pingTimer = setInterval(() => {
        if (!isAlive) {
          log.warn("Heartbeat missed — reconnecting.");
          ws.terminate();
          return;
        }
        isAlive = false;
        ws.ping();
      }, HEARTBEAT_INTERVAL_MS);
    });

    ws.on("pong", () => {
      isAlive = true;
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      isAlive = true;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg.id === 1 && typeof msg.result === "number") {
        subscriptionId = msg.result;
        log.info(`accountSubscribe confirmed — sub id: ${subscriptionId}`);
        return;
      }

      if (
        msg.method !== "accountNotification" ||
        typeof msg.params !== "object" ||
        msg.params === null
      ) {
        return;
      }

      const params = msg.params as Record<string, unknown>;
      if (params.subscription !== subscriptionId) return;

      log.info("Account change detected — parsing transfers...");

      // Fire-and-forget: the producer only parses + dispatches, never awaited.
      processAccountChange(marketAta, rawMultiplier, onTransfer).catch((err) => {
        log.error("processAccountChange error:", err);
      });
    });

    ws.on("close", (code, reason) => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      const reasonStr = reason?.toString() ?? "";
      log.warn(
        `WebSocket closed (code: ${code}${reasonStr ? `, reason: ${reasonStr}` : ""}) — scheduling reconnect.`,
      );
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      log.error("WebSocket error:", err.message);
    });
  }

  function scheduleReconnect(): void {
    retryCount++;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** (retryCount - 1) + Math.random() * 1_000,
      RECONNECT_MAX_MS,
    );
    log.info(`Reconnecting in ${Math.round(delay)}ms (attempt ${retryCount})...`);
    setTimeout(connect, delay);
  }

  connect();
}

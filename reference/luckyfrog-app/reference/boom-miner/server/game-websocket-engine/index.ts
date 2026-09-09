/**
 * server/game-websocket-engine/index.ts
 *
 * Entry point for the game WebSocket engine.
 * Run with: pnpm run server:websocket-start
 *
 * Reads from environment:
 *   MONGODB_URI    — MongoDB connection string (required)
 *   JWT_SECRET     — shared with the Next.js app (required)
 *   PORT           — server port (default: 4000)
 *   CORS_ORIGIN    — comma-separated allowed origins (unset = allow all, recommended for local testing only)
 *
 * Architecture:
 *   http.createServer → Socket.IO attaches to it
 *   authMiddleware    → runs before every connection
 *   registerHandlers  → called once per authenticated connection
 *   FlushScheduler    → 30s interval writes dirty sessions to DB + backfill
 */

import { createServer } from "http";
import { Server } from "socket.io";
import { connectDatabase } from "@/lib/config/database";
import { SessionStore } from "./session/SessionStore";
import { FlushScheduler } from "./session/FlushScheduler";
import { RegenScheduler } from "./session/RegenScheduler";
import { authMiddleware } from "./socket/auth";
import { registerHandlers } from "./socket/handlers";

// ---- Config ----------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "4000", 10);

// When CORS_ORIGIN is not set, allow all origins (*) — useful for local
// testing so you don't need to enumerate every dev URL.
// In production, set CORS_ORIGIN to a comma-separated list of allowed origins.
const CORS_ORIGIN: string | string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : "*";

// ---- Bootstrap -------------------------------------------------------------

async function main(): Promise<void> {
  // Ensure the DB is connected before accepting any socket connections.
  await connectDatabase();
  console.log("[WS Engine] MongoDB connected");

  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin:      CORS_ORIGIN,
      methods:     ["GET", "POST"],
      // credentials cannot be used with wildcard origin; only set when a
      // specific origin list is provided.
      credentials: CORS_ORIGIN !== "*",
    },
    // Prefer WebSocket; fall back to long-polling for restrictive networks.
    transports:  ["websocket", "polling"],
  });

  const store   = new SessionStore();
  const flusher = new FlushScheduler(store);
  const regen   = new RegenScheduler(store);

  // Auth middleware — runs before connection event fires.
  io.use(authMiddleware);

  io.on("connection", (socket) => {
    console.log(`[WS Engine] connected: ${socket.data.wallet} (${socket.id})`);
    registerHandlers(socket, io, store, flusher).catch((err) => {
      console.error(`[WS Engine] registerHandlers failed for ${socket.data.wallet}:`, err);
      socket.disconnect(true);
    });
  });

  flusher.start();
  regen.start();

  httpServer.listen(PORT, () => {
    console.log(`[WS Engine] listening on port ${PORT}`);
    console.log(`[WS Engine] CORS origins: ${CORS_ORIGIN === "*" ? "* (all — set CORS_ORIGIN in production)" : (CORS_ORIGIN as string[]).join(", ")}`);
  });

  // Graceful shutdown — flush all dirty sessions before exit.
  const shutdown = async (signal: string) => {
    console.log(`[WS Engine] ${signal} received — flushing all sessions before exit`);
    flusher.stop();
    regen.stop();
    await flusher.flushAll();
    console.log("[WS Engine] flush complete — exiting");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[WS Engine] fatal startup error:", err);
  process.exit(1);
});

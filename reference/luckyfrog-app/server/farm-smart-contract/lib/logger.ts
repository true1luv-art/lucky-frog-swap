/**
 * server/farm-smart-contract/lib/logger.ts
 *
 * Minimal structured logger for the VPS server process.
 * Prefixes every line with an ISO timestamp and a severity tag so logs
 * are easy to parse by pm2 / journalctl / grep.
 *
 * Usage:
 *   import { log } from "./logger";
 *   log.info("watcher", "Scanned block", { from: 1000, to: 1050 });
 *   log.error("consumer", "Failed to credit deposit", err);
 */

type Level = "INFO" | "WARN" | "ERROR";

function emit(level: Level, scope: string, message: string, meta?: unknown): void {
  const ts   = new Date().toISOString();
  const base = `[${ts}] [${level}] [${scope}] ${message}`;
  if (meta !== undefined) {
    if (meta instanceof Error) {
      console[level === "ERROR" ? "error" : "log"](base, meta.message, meta.stack);
    } else {
      console[level === "ERROR" ? "error" : "log"](base, JSON.stringify(meta));
    }
  } else {
    console[level === "ERROR" ? "error" : "log"](base);
  }
}

export const log = {
  info:  (scope: string, message: string, meta?: unknown) => emit("INFO",  scope, message, meta),
  warn:  (scope: string, message: string, meta?: unknown) => emit("WARN",  scope, message, meta),
  error: (scope: string, message: string, meta?: unknown) => emit("ERROR", scope, message, meta),
};

/**
 * server/luckfrog-smart-contract-test/lib/logger.ts
 *
 * Tiny tagged logger so every line from the runtime is prefixed with
 * `[luckfrog-sc]` and easy to grep in aggregated logs.
 */
import { LOG_TAG } from "../config";

const prefix = `[${LOG_TAG}]`;

export const log = {
  info: (...args: unknown[]) => console.log(prefix, ...args),
  warn: (...args: unknown[]) => console.warn(prefix, ...args),
  error: (...args: unknown[]) => console.error(prefix, ...args),
};

/**
 * server/luckfrog-smart-contract-test/env.ts
 *
 * Loads .env files before anything else, using the SAME priority order Next.js
 * uses so the standalone runtime and the web app resolve identical values:
 *
 *   .env < .env.local < .env.development < .env.development.local
 *
 * This module has side effects only — import it (for its side effect) at the
 * very top of `config.ts` so every `process.env` read below sees the loaded
 * values. Never read `process.env` before this module has run.
 */
import "dotenv/config";
import dotenv from "dotenv";
import path from "path";

const root = path.resolve(process.cwd());

dotenv.config({ path: path.join(root, ".env"), override: false });
dotenv.config({ path: path.join(root, ".env.local"), override: true });
dotenv.config({ path: path.join(root, ".env.development"), override: true });
dotenv.config({ path: path.join(root, ".env.development.local"), override: true });

/**
 * POST /api/quests/[id]/complete
 *
 * Quest completion endpoint. §3.4-A
 *
 * Validates the request, calls the quest completion handler, and returns
 * the full completion result including guaranteed rewards and all roll results.
 *
 * The roll results are returned to the client so the reward reveal UI can
 * animate each roll one at a time. §3.4-D
 *
 * Response (200):
 * ```json
 * {
 *   "success": true,
 *   "guaranteed": { "guaranteedShards": [...], "skillXp": N, "baseRolls": N },
 *   "rolls": [ { "roll": 1, "rarity": "common", "amount": 3, "jackpot": false }, ... ],
 *   "totalRolls": N
 * }
 * ```
 *
 * Error responses:
 *   401 — Unauthorized
 *   404 — Quest not found / QUEST_NOT_FOUND
 *   409 — Quest not active / QUEST_NOT_ACTIVE / CONCURRENT_COMPLETE
 *   400 — Insufficient items / INSUFFICIENT_ITEMS
 *   500 — Unexpected server error
 *
 * Auth: Bearer token or lfrg_token cookie.
 *
 * Reference: docs/implementation_plans/phase-03-quest-system.md §3.4-A · §3.4-D
 */

import { getWallet }      from "@/lib/api/get-wallet";
import { apiError, apiOk } from "@/lib/api/error-response";
import { completeQuest }  from "@/lib/events/quest-complete/action";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────

  const wallet = await getWallet(req);
  if (!wallet) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  // ── Extract quest ID ──────────────────────────────────────────────────────

  const { id: questId } = await params;
  if (!questId || typeof questId !== "string" || questId.length < 1) {
    return apiError("Invalid quest ID.", "INVALID_QUEST_ID", 400);
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  try {
    const result = await completeQuest(wallet, questId);

    return apiOk({
      guaranteed: result.guaranteed,
      rolls:      result.rolls,
      totalRolls: result.totalRolls,
    });
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };

    // Known domain errors — return structured 4xx
    if (e.code) {
      return apiError(e.message, e.code, e.status ?? 400);
    }

    // Unexpected server error
    console.error("[quest/complete] Unexpected error:", err);
    return apiError("An unexpected error occurred.", "INTERNAL_ERROR", 500);
  }
}

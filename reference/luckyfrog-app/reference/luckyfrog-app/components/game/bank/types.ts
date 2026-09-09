import type { DropResult } from "@/shared/drops/logic";

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export interface ClaimSuccessPayload {
  drop: DropResult;
  // §C4 — xpGained, xp, level, leveledUp, newLevel removed ("No Player Level", §5.13)
}

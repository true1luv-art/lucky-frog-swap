/**
 * POST /api/bank/deposit
 *
 * Deprecated: direct coin deposits without an on-chain HFARM transfer are no
 * longer supported. All deposits must go through the chain-verified endpoint.
 *
 * Use POST /api/bank/deposit/verify instead, passing { txHash, amount } after
 * completing the on-chain HFARM transfer to the treasury address.
 */

import { apiError } from "@/lib/api/error-response";

export async function POST() {
  return apiError(
    "Direct deposits are no longer supported. Use POST /api/bank/deposit/verify with { txHash, amount } after completing the on-chain HFARM transfer.",
    "DEPRECATED",
    410,
  );
}

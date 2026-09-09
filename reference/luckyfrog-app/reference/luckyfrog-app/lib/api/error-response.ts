/**
 * Shared API error response helper. §1.6-D
 *
 * All Phase 1 (and beyond) API routes use this helper to guarantee a consistent
 * error shape: { success: false, error: string, code: string }
 *
 * The `code` field is a machine-readable slug that clients can switch on without
 * parsing the human-readable `error` string.
 *
 * Usage:
 *   return apiError("Player not found", "PLAYER_NOT_FOUND", 404);
 *   return apiError("Invalid JSON body", "INVALID_JSON", 400);
 */

export function apiError(
  error: string,
  code: string,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  return Response.json(
    { success: false, error, code, ...extra },
    { status },
  );
}

export function apiOk<T extends Record<string, unknown>>(
  data: T,
  status = 200,
): Response {
  return Response.json({ success: true, ...data }, { status });
}

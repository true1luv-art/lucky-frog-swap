import { execute } from "@/lib/events/register-player/action";
import { apiError } from "@/lib/api/error-response";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_JSON", 400);
  }

  const result = await execute(body as Parameters<typeof execute>[0]);

  if (result.status === "invalid-wallet") {
    return apiError("Invalid or missing wallet address", "INVALID_WALLET", 400);
  }
  if (result.status === "invalid-signature") {
    return apiError("Wallet signature verification failed", "INVALID_SIGNATURE", 401);
  }
  if (result.status === "balance-check-failed") {
    return apiError("Could not verify on-chain LFRG balance — try again shortly", "BALANCE_CHECK_FAILED", 503);
  }
  if (result.status === "insufficient-balance") {
    return apiError(
      "Insufficient LFRG balance to register",
      "INSUFFICIENT_BALANCE",
      402,
      { balance: result.balance, minHold: result.minHold },
    );
  }
  if (result.status === "username-taken") {
    return apiError("That username is already taken", "USERNAME_TAKEN", 409);
  }
  if (result.status === "username-required") {
    return apiError("Username must be at least 3 characters", "USERNAME_TOO_SHORT", 400);
  }
  if (result.status === "username-invalid") {
    return apiError("Username may only contain letters, numbers, and underscores (3–24 chars)", "USERNAME_INVALID", 400);
  }

  // "ok" and "already-registered" both return 200 with player + token
  return Response.json({ success: true, ...result });
}

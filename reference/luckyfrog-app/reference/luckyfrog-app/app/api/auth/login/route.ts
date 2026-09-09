import { execute } from "@/lib/events/login-player/action";
import type { LoginPlayerInput } from "@/lib/events/login-player/action";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof execute>>;
  try {
    result = await execute(body as LoginPlayerInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[login] execute() threw:", message);
    return Response.json({ status: "error", error: message }, { status: 500 });
  }

  // Always return { status, ... } so the client can branch on data.status.
  if (result.status === "invalid-wallet") {
    return Response.json({ status: "invalid-wallet" }, { status: 400 });
  }
  if (result.status === "invalid-signature") {
    return Response.json({ status: "invalid-signature" }, { status: 401 });
  }
  if (result.status === "balance-check-failed") {
    return Response.json({ status: "balance-check-failed" }, { status: 503 });
  }
  if (result.status === "insufficient-balance") {
    return Response.json(
      { status: "insufficient-balance", balance: result.balance, minHold: result.minHold },
      { status: 402 },
    );
  }
  if (result.status === "not-registered") {
    return Response.json({ status: "not-registered" }, { status: 404 });
  }

  return Response.json(result);
}

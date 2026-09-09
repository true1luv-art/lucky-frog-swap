/**
 * GET /api/auth/demo
 *
 * Sets an rhf_demo=1 cookie and redirects to /game.
 * No JWT is issued — the game layout detects the demo cookie and injects
 * a fake PlayerSnapshot with wallet "demo" instead of querying the DB.
 * All game actions remain client-side only; no DB writes occur.
 */

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect(
    new URL("/game", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  );
  // Session-scoped cookie — cleared when the browser tab closes.
  response.cookies.set("rhf_demo", "1", {
    path:     "/",
    httpOnly: false, // Readable by JS so the store can detect demo mode
    sameSite: "lax",
    // No maxAge → session cookie, auto-cleared on tab close
  });
  return response;
}

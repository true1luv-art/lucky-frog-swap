/**
 * GET /api/price/lfrg
 *
 * Returns the live $LFRG USD price and the LFRG token amount required for
 * a $2 USD farm-level unlock.
 *
 * Response is cached by Next.js fetch for 60s (via lfrgPrice.server.ts).
 * An explicit Cache-Control header is also set for CDN/browser caching.
 */

import { NextResponse } from "next/server";
import { fetchLfrgPrice } from "@/lib/modules/price/lfrgPrice.server";

export const revalidate = 60; // ISR-style revalidation

export async function GET() {
  try {
    const price = await fetchLfrgPrice();
    return NextResponse.json(price, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

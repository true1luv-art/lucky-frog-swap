import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/login",
  "/phaser",
  "/dashboard",
  "/collection",
  "/market",
  "/leaderboard",
  "/profile",
];

/** @param {import('next/server').NextRequest} request */
export function proxy(request) {
  const maintenance = process.env.MAINTENANCE_MODE === "true";

  if (!maintenance) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Already on the maintenance page — let it through to avoid redirect loop
  if (pathname.startsWith("/maintenance")) return NextResponse.next();

  const blocked = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (blocked) {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimisation)
     * - favicon & public assets
     * - api routes (keep health-checks alive during maintenance)
     */
    "/((?!_next/static|_next/image|favicon|assets|api).*)",
  ],
};

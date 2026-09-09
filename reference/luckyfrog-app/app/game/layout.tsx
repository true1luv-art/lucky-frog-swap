import type { Metadata } from "next";
import type { ReactNode } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { AudioProvider } from "@/context/AudioContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";


export const metadata: Metadata = {
  title: "HFARM — Play",
  description: "Farm, craft and trade in HFARM",
};

/**
 * PlayerSnapshot — defined inline to avoid the import chain through
 * GameShell.tsx that caused Next.js/Turbopack to silently drop the
 * (phaser) route from its manifest.
 *
 * Must stay in sync with the type exported from context/PlayerContext.tsx.
 */
interface PlayerSnapshot {
  username: string;
  wallet: string;
  sol: number;
}

/** Fake PlayerSnapshot used when rhf_demo=1 is set. No DB access. */
const DEMO_PLAYER: PlayerSnapshot = {
  username: "Demo",
  wallet:   "demo",
  sol:      0,
};

async function getSessionPlayer(): Promise<{
  wallet: string;
  player: PlayerSnapshot | undefined;
  isDemo?: boolean;
} | null> {
  try {
    const cookieStore = await cookies();

    // Demo mode — no JWT required, no DB access.
    if (cookieStore.get("rhf_demo")?.value === "1") {
      return { wallet: "demo", player: DEMO_PLAYER, isDemo: true };
    }

    const token = cookieStore.get("rhf_token")?.value;
    if (!token) return null;

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? "dev-secret-change-me",
    );
    const { payload } = await jwtVerify(token, secret);
    const wallet = payload.wallet as string;
    if (!wallet) return null;

    const doc = await findPlayerByWallet(wallet);

    // Player document was deleted — clear the stale cookie and treat as unauthenticated.
    if (!doc) {
      cookieStore.delete("rhf_token");
      return null;
    }

    const player: PlayerSnapshot = {
      username: doc.username ?? wallet.slice(0, 8),
      wallet,
      sol: 0,
    };

    return { wallet, player };
  } catch {
    return null;
  }
}

/**
 * PhaserV1Layout
 *
 * Full-screen wrapper — no GameShell, no BottomNav, no GameHeader.
 * JWT auth guard: unauthenticated visitors are redirected to /login.
 *
 * Note: <html> and <body> are owned by the root app/layout.tsx.
 * This nested layout only renders providers + the full-screen black wrapper.
 */
export default async function PhaserLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionPlayer();

  if (!session) {
    redirect("/");
  }

  return (
    <PlayerProvider initialPlayer={session.player}>
      <AudioProvider>
        <div data-game-route className="h-screen w-screen overflow-hidden bg-black">
          {children}
        </div>
      </AudioProvider>
    </PlayerProvider>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { AudioProvider } from "@/context/AudioContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { getSolBalance } from "@/lib/solana/balance.server";

export const metadata: Metadata = {
  title: "Lucky Frog — Town",
  description: "Explore the Lucky Frog town",
};

/**
 * PlayerSnapshot — defined inline to avoid the import chain through
 * GameShell.tsx that caused Next.js/Turbopack to silently drop the
 * (phaser) route from its manifest.
 *
 * Must stay in sync with the type exported from components/game/GameShell.tsx.
 */
interface PlayerSnapshot {
  username: string;
  wallet: string;
  lfrg: number;
  sol: number;
  // §C4 — player level / exp removed ("No Player Level", §5.13)
  // §Phase 3 — mining stat removed (frogs/eggs/mining removed from game)
  stats: {
    luck: number;
    crit: number;
    dodge: number;
  };
}

async function getSessionPlayer(): Promise<{
  wallet: string;
  player: PlayerSnapshot | undefined;
} | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("lfrg_token")?.value;
    if (!token) return null;

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? "dev-secret-change-me",
    );
    const { payload } = await jwtVerify(token, secret);
    const wallet = payload.wallet as string;
    if (!wallet) return null;

    const [doc, solBalance] = await Promise.all([
      findPlayerByWallet(wallet),
      getSolBalance(wallet),
    ]);

    // §C4 — player level / exp removed ("No Player Level", §5.13)
    // Mining stat removed in Phase 3 cleanup (frogs/eggs/mining removed)
    const player: PlayerSnapshot | undefined = doc
      ? {
          username: doc.username ?? wallet.slice(0, 8),
          wallet,
          lfrg: doc.lfrg ?? 0,
          sol: solBalance ?? 0,
          stats: {
            luck:   doc.stats?.luck   ?? 0,
            crit:   doc.stats?.crit   ?? 0,
            dodge:  doc.stats?.dodge  ?? 0,
          },
        }
      : undefined;

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
    redirect("/login");
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

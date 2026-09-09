import { createFileRoute, ClientOnly, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

import { AudioProvider } from "@/context/AudioContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { useSession } from "@/features/game-stores/useSession";


const PhaserCanvas = lazy(() => import("@/phaser/PhaserCanvas"));

export const Route = createFileRoute("/game")({
  head: () => ({
    meta: [
      { title: "Play — Lucky Frog" },
      {
        name: "description",
        content: "Farm, craft, fish and trade in Lucky Frog. Progress is saved in your browser.",
      },
      { property: "og:title", content: "Play — Lucky Frog" },
      {
        property: "og:description",
        content: "Farm, craft, fish and trade in Lucky Frog. Progress is saved in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamePage,
});

function Loading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black">
      <p className="font-pixel text-[10px] text-neon">Loading farm<span className="loading" /></p>
    </div>
  );
}

function GamePage() {
  const navigate = useNavigate();
  const username = useSession((s) => s.username);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useSession.persist.onFinishHydration(() => setHydrated(true));
    void Promise.resolve(useSession.persist.rehydrate()).then(() => setHydrated(true));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (hydrated && !username) void navigate({ to: "/" });
  }, [hydrated, username, navigate]);

  return (
    <PlayerProvider
      initialPlayer={{ username: username ?? "Farmer", wallet: "local", sol: 0 }}
    >
      <AudioProvider>
        <div data-game-route className="h-screen w-screen overflow-hidden bg-black">
          <ClientOnly fallback={<Loading />}>
            <Suspense fallback={<Loading />}>
              <PhaserCanvas />
            </Suspense>
          </ClientOnly>
        </div>
      </AudioProvider>
    </PlayerProvider>
  );
}

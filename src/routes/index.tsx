import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useSession } from "@/features/game-stores/useSession";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lucky Frog — Pixel Farming Adventure" },
      {
        name: "description",
        content:
          "Plant, harvest, fish, mine and trade in Lucky Frog — a pixel-art farming adventure that runs right in your browser.",
      },
      { property: "og:title", content: "Lucky Frog — Pixel Farming Adventure" },
      {
        property: "og:description",
        content:
          "Plant, harvest, fish, mine and trade in Lucky Frog — a pixel-art farming adventure that runs right in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const signIn = useSession((s) => s.signIn);
  const saved = useSession((s) => s.username);
  const [name, setName] = useState("");

  function enterFarm(e: React.FormEvent) {
    e.preventDefault();
    signIn(name || saved || "Farmer");
    void navigate({ to: "/game" });
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[10%] -top-[20%] h-[60%] w-[60%] rounded-full bg-neon opacity-[0.08] blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[5%] h-[50%] w-[50%] rounded-full bg-gold opacity-[0.06] blur-[150px]" />
      </div>

      <section className="relative w-full max-w-md space-y-8 text-center">
        <img
          src="/images/robinhood-farm-logo.png"
          alt="Lucky Frog logo"
          className="mx-auto h-20 w-auto pixelated"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />

        <div className="space-y-3">
          <h1 className="font-pixel text-2xl leading-relaxed text-neon text-outline">
            Robinhood Farm
          </h1>
          <p className="font-body text-[10px] leading-relaxed text-muted-foreground">
            Plant crops, chop wood, mine ore, fish and trade. Your farm is saved
            in this browser — no account needed.
          </p>
        </div>

        <form onSubmit={enterFarm} className="space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={saved ?? "Your farmer name"}
            maxLength={20}
            aria-label="Farmer name"
            className="w-full border-2 border-foreground/30 bg-card px-4 py-3 text-center font-body text-[10px] text-foreground outline-hidden focus:border-neon"
          />
          <button
            type="submit"
            className="w-full border-2 border-foreground bg-neon px-4 py-3 font-pixel text-[10px] uppercase tracking-widest text-primary-foreground transition-all hover:brightness-110 active:translate-y-px"
          >
            {saved ? "Continue farming" : "Start farming"}
          </button>
        </form>
      </section>
    </main>
  );
}

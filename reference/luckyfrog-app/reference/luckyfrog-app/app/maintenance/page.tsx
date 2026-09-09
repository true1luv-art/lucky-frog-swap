import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Down for Maintenance | Lucky Frog Mine",
  description: "Lucky Frog Mine is currently undergoing scheduled maintenance. Check back soon.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground flex items-center justify-center px-6">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[10%] -top-[20%] h-[60%] w-[60%] rounded-full bg-neon opacity-[0.06] blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[5%] h-[50%] w-[50%] rounded-full bg-gold opacity-[0.04] blur-[150px]" />
      </div>

      <main className="relative w-full max-w-lg text-center space-y-10">

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 border-2 border-gold/40 bg-gold/10 px-4 py-2">
          <span className="h-1.5 w-1.5 animate-pulse bg-gold shadow-[0_0_8px_var(--color-gold)]" />
          <span className="font-pixel text-[8px] uppercase tracking-widest text-gold">
            Scheduled Maintenance
          </span>
        </div>

        {/* Frog icon — simple pixel art via CSS */}
        <div className="flex justify-center">
          <div className="relative w-20 h-20 animate-float">
            {/* Body */}
            <div className="absolute inset-0 border-4 border-border bg-neon/20" />
            {/* Eyes */}
            <div className="absolute top-4 left-4 w-3 h-3 border-2 border-border bg-foreground" />
            <div className="absolute top-4 right-4 w-3 h-3 border-2 border-border bg-foreground" />
            {/* Mouth */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-1 bg-border" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-4">
          <h1 className="font-pixel text-2xl leading-snug text-foreground sm:text-3xl">
            THE MINE IS<br />
            <span className="text-neon text-glow">CLOSED</span>
          </h1>
          <p className="font-body text-xl leading-relaxed text-muted-foreground">
            Lucky Frog Mine is undergoing scheduled maintenance.
            The frogs are resting — we&apos;ll be back soon.
          </p>
        </div>

        {/* Pixel divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-widest">
            Stand by
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Status detail card */}
        <div className="border-4 border-border bg-card/80 p-6 shadow-[6px_6px_0_0_var(--color-border)] space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 bg-gold" />
            <p className="font-body text-base leading-relaxed text-muted-foreground">
              Mining rewards and stash balances are safe — no action is needed from you.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 bg-neon" />
            <p className="font-body text-base leading-relaxed text-muted-foreground">
              Follow{" "}
              <a
                href="https://x.com/luckyfrog_sol"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon text-glow underline decoration-dotted underline-offset-4 hover:opacity-80"
              >
                @luckyfrog_sol
              </a>{" "}
              on X for live status updates.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="font-pixel text-[8px] uppercase tracking-widest text-muted-foreground">
          Lucky Frog &mdash; $LFRG on Solana
        </p>

      </main>
    </div>
  );
}

import type { Metadata } from "next";
import type React from "react";
import Leaderboard from "@/components/Leaderboard";
import { GamePreview } from "@/components/GamePreview";
import GameStats from "@/components/GameStats";
import StickyNav from "@/components/StickyNav";
import { OuterPanel, InnerPanel } from "@/components/ui/Panel";

const SITE_URL = "https://www.luckyfrog.online";

const IMAGES = {
  frog: "/assets/brand/lucky_frog.png",
  banner: "/assets/brand/lucky_frog_banner.png",
  og: "/assets/brand/lucky-frog-og.png",
  moon: "/assets/brand/lucky_frog_moon.png",
  casino: "/assets/brand/lucky_frog_casino.png",
  king: "/assets/brand/lucky_frog_king.png",
  wizard: "/assets/brand/lucky_frog_wizard.png",
};

export const metadata: Metadata = {
  title: "Lucky Frog ($LFRG) — The Luckiest Frog on Solana",
  description:
    "Lucky Frog hopped out of the pond to bring good vibes, lucky trades, and legendary memes. No roadmap. No promises. Just luck. $LFRG on Solana.",
  openGraph: {
    title: "Lucky Frog ($LFRG) — The Luckiest Frog on Solana",
    description:
      "A crowned frog blessed with unlimited luck. Hold the frog. Trust the luck.",
    type: "website",
    url: `${SITE_URL}/`,
    images: [{ url: IMAGES.og }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lucky Frog ($LFRG) — The Luckiest Frog on Solana",
    description:
      "A crowned frog blessed with unlimited luck. Hold the frog. Trust the luck.",
    images: [IMAGES.og],
    site: "@luckyfrog_sol",
  },
  alternates: {
    canonical: `${SITE_URL}/`,
  },
};

function Clover({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <span
      className={`pointer-events-none absolute text-2xl animate-float-slow ${className}`}
      style={{ animationDelay: `${delay}s` }}
      aria-hidden="true"
    >
      🍀
    </span>
  );
}

function Sparkle({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <span
      className={`pointer-events-none absolute text-neon animate-sparkle ${className}`}
      style={{ animationDelay: `${delay}s`, textShadow: "0 0 8px currentColor" }}
      aria-hidden="true"
    >
      ✦
    </span>
  );
}

function LilyPad({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`pointer-events-none absolute animate-float-slow ${className}`}
      style={{ animationDelay: `${delay}s` }}
      aria-hidden="true"
    >
      <svg width="80" height="60" viewBox="0 0 80 60" className="opacity-70">
        <ellipse
          cx="40"
          cy="35"
          rx="36"
          ry="18"
          fill="var(--color-lily)"
          stroke="var(--color-foreground)"
          strokeWidth="3"
        />
        <path
          d="M40 35 L72 35"
          stroke="var(--color-foreground)"
          strokeWidth="3"
        />
        <ellipse cx="55" cy="22" rx="6" ry="3" fill="var(--color-accent)" />
      </svg>
    </div>
  );
}

function PixelButton({
  children,
  variant = "primary",
  href,
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  href?: string;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-6 py-4 font-pixel text-xs sm:text-sm uppercase tracking-wide border-2 transition-all duration-150 active:brightness-90";
  const styles =
    variant === "primary"
      ? "bg-neon text-primary-foreground border-neon/60 hover:brightness-110"
      : "bg-card text-neon border-neon hover:bg-neon hover:text-primary-foreground";

  return (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </a>
  );
}

function Marquee() {
  const items = [
    "🍀 LUCKY FROG",
    "👑 $LFRG",
    "🐸 RIBBIT",
    "⚡ SOLANA",
    "🚀 TO THE MOON",
    "🍀 HOLD THE FROG",
    "👑 TRUST THE LUCK",
  ];
  return (
    <div className="overflow-hidden border-y-2 border-brown-600 bg-brown-600 py-3">
      <div className="flex w-max animate-marquee gap-12 whitespace-nowrap font-pixel text-xs text-white text-shadow">
        {[...items, ...items, ...items, ...items].map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function MemeCard({
  image,
  title,
  caption,
}: {
  image: string;
  title: string;
  caption: string;
}) {
  return (
    <OuterPanel className="group flex flex-col">
      <InnerPanel className="flex flex-col h-full">
        <div className="relative aspect-square overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <div className="p-3">
          <h4 className="font-pixel text-[10px] text-white text-shadow">{title}</h4>
          <p className="mt-2 font-body text-base text-white/80 text-shadow">{caption}</p>
        </div>
      </InnerPanel>
    </OuterPanel>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <StickyNav />

        {/* Background lily pads */}
        <LilyPad className="left-[5%] top-[15%]" delay={0} />
        <LilyPad className="right-[8%] top-[40%]" delay={1.5} />
        <LilyPad className="left-[10%] top-[70%]" delay={2.5} />
        <LilyPad className="right-[15%] top-[85%]" delay={0.8} />

        {/* Hero */}
        <section
          id="top"
          className="relative overflow-hidden bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/bg-login.png')" }}
        >


          <div className="relative z-10 mx-auto max-w-7xl px-4 pt-24 pb-20 sm:px-8 sm:pt-28">
          <Sparkle className="left-[15%] top-[10%] text-3xl" delay={0} />
          <Sparkle className="right-[20%] top-[20%] text-2xl" delay={0.5} />
          <Sparkle className="left-[40%] top-[5%] text-xl" delay={1} />
          <Sparkle className="right-[10%] top-[50%] text-3xl" delay={1.5} />
          <Clover className="left-[8%] top-[60%]" delay={0.3} />
          <Clover className="right-[5%] top-[30%]" delay={1.2} />

          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="absolute -inset-4 -z-10 bg-neon/10 blur-3xl" />
              <Sparkle className="-left-2 top-4 text-2xl" delay={0.2} />
              <Sparkle className="-right-2 top-8 text-xl" delay={0.7} />
              <Sparkle className="left-1/2 -top-2 text-2xl" delay={1.1} />
              <h1 className="sr-only">
                Lucky Frog ($LFRG) — The Luckiest Frog on Solana
              </h1>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={IMAGES.banner}
                alt="Lucky Frog — The Luckiest Frog on Solana"
                width={444}
                height={222}
                className="max-w-full"
              />
            </div>

            <p className="mt-2 max-w-2xl font-body text-xl text-white sm:text-2xl [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
              A crowned frog blessed with unlimited luck. Hopped out of the
              pond to bring good vibes, lucky trades, and legendary memes.{" "}
              <span className="text-neon">
                No roadmap. No promises. Just luck.
              </span>
            </p>

            <div className="mt-10 flex w-full flex-col gap-4 px-4 sm:w-auto sm:flex-row sm:px-0">
              <PixelButton variant="primary" href="https://pump.fun/coin/rguPVQY61jq14vwShEaNuSiCXYGG3bwWzwa3XJHpump">
                Buy $LFRG
              </PixelButton>
              <PixelButton variant="secondary" href="/login">
                Enter The Mine
              </PixelButton>
            </div>
          </div>
          </div>
        </section>

        <Marquee />

        {/* Token identity bar */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {[
              { label: "Ticker", value: "$LFRG", accent: "text-neon" },
              { label: "Chain", value: "Solana", accent: "text-accent" },
              { label: "Status", value: "Community", accent: "text-rose" },
              { label: "Launch", value: "Pump.fun", accent: "text-gold" },
            ].map((s) => (
              <OuterPanel key={s.label}>
                <InnerPanel className="p-3 text-center sm:p-5">
                  <div className="font-pixel text-[10px] uppercase text-white/70 sm:text-xs">
                    {s.label}
                  </div>
                  <div className={`mt-2 font-pixel text-sm text-shadow sm:mt-3 sm:text-lg ${s.accent}`}>
                    {s.value}
                  </div>
                </InnerPanel>
              </OuterPanel>
            ))}
          </div>
        </section>

        {/* Live token stats — price, market cap, supply, holders */}
        <GameStats />

        {/* Story */}
        <section
          id="story"
          className="relative mx-auto max-w-6xl px-4 py-20 sm:px-8"
        >
          <Clover className="right-[10%] top-0" delay={0.5} />
          <OuterPanel className="relative pt-5">
            {/* Tab sits in the absolute gap above InnerPanel, matching hearthvale Tab style */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
              <OuterPanel className="!py-0 !px-0">
                <InnerPanel className="px-5 py-1">
                  <span className="font-pixel text-[9px] text-white text-shadow uppercase tracking-wider">
                    LORE
                  </span>
                </InnerPanel>
              </OuterPanel>
            </div>
            <InnerPanel className="p-6 sm:p-10">
                <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
                  <div className="text-center lg:text-right">
                    <h2 className="font-pixel text-lg text-white text-shadow sm:text-xl md:text-2xl">
                      THE LEGEND<br />OF LUCKY FROG
                    </h2>
                  </div>
                  <div className="mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={IMAGES.frog}
                      alt="Lucky Frog mascot"
                      className="animate-float h-32 w-32 sm:h-40 sm:w-40"
                    />
                  </div>
                  <div className="space-y-4 font-body text-xl text-white text-shadow sm:text-2xl">
                    <p>
                      Deep inside the{" "}
                      <span className="text-neon">Solana Swamp</span> lives a frog
                      blessed by luck itself.
                    </p>
                    <p>
                      One day he discovered a{" "}
                      <span className="text-gold">golden crown</span>{" "}
                      hidden beneath an ancient lily pad.
                    </p>
                    <p>
                      Since then every leap became a{" "}
                      <span className="text-neon">lucky leap</span>. Every holder
                      became a Lucky Frog.
                    </p>
                  </div>
                </div>
              </InnerPanel>
            </OuterPanel>
        </section>

        {/* Features */}
        <section
          id="features"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-8"
        >
          <div className="mb-12 text-center">
            <h2 className="font-pixel text-xl text-neon sm:text-2xl md:text-3xl">
              WHY $LFRG?
            </h2>
            <p className="mt-3 font-body text-base text-foreground/70 sm:text-lg md:text-xl">
              Four reasons. Zero promises. Pure ribbit.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "🍀",
                title: "Lucky Vibes",
                desc: "Every wallet that holds gets touched by frog luck. Probably.",
              },
              {
                icon: "🐸",
                title: "Frog Community",
                desc: "The swamp is loud, weird, and welcoming. Hop in.",
              },
              {
                icon: "👑",
                title: "Crowned Meme King",
                desc: "Pepe walked so the crowned frog could leap.",
              },
              {
                icon: "⚡",
                title: "Solana Speed",
                desc: "Lightning leaps. Sub-cent fees. Built to hop fast.",
              },
            ].map((f) => (
              <OuterPanel key={f.title}>
                <InnerPanel className="p-5 h-full">
                  <div className="mb-4 text-4xl" aria-hidden="true">
                    {f.icon}
                  </div>
                  <h3 className="font-pixel text-xs text-white text-shadow">{f.title}</h3>
                  <p className="mt-3 font-body text-lg text-white/80 text-shadow">
                    {f.desc}
                  </p>
                </InnerPanel>
              </OuterPanel>
            ))}
          </div>
        </section>

        {/* Milestones */}
        <section id="milestones" className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
          <div className="mb-14 text-center">
            <h2 className="font-pixel text-xl text-neon sm:text-2xl md:text-3xl">
              MILESTONES
            </h2>
            <p className="mt-3 font-body text-base text-foreground/70 sm:text-lg md:text-xl">
              Every hop counts. Here is where we have been.
            </p>
          </div>

          {/* Timeline — each row is a 3-col grid: left | node | right */}
          <div className="relative flex flex-col gap-10">
            {/* Centre line — sits behind all rows */}
            <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-0.5 -translate-x-1/2 bg-brown-400 md:block" />

            {/* 01 — Token Launch */}
            <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
              <OuterPanel className="md:mr-8">
                <InnerPanel className="p-5 md:text-right">
                  <div className="font-pixel text-[10px] uppercase text-gold mb-2">01</div>
                  <h3 className="font-pixel text-xs text-white text-shadow mb-3">Token Launch</h3>
                  <p className="font-body text-lg text-white/80 text-shadow leading-relaxed">
                    $LFRG goes live on Pump.fun on the Solana blockchain. The frog enters the swamp.
                  </p>
                </InnerPanel>
              </OuterPanel>
              <div className="z-10 mx-auto flex h-8 w-8 shrink-0 items-center justify-center border-4 border-neon bg-brown-100">
                <div className="h-2 w-2 bg-neon" />
              </div>
              <div className="flex items-center md:ml-8">
                <span className="font-pixel text-[9px] uppercase text-neon border-2 border-neon px-3 py-1">Done</span>
              </div>
            </div>

            {/* 02 — Website & Socials */}
            <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
              <div className="flex items-center md:justify-end md:mr-8 order-2 md:order-1">
                <span className="font-pixel text-[9px] uppercase text-neon border-2 border-neon px-3 py-1">Done</span>
              </div>
              <div className="z-10 mx-auto flex h-8 w-8 shrink-0 items-center justify-center border-4 border-neon bg-brown-100 order-1 md:order-2">
                <div className="h-2 w-2 bg-neon" />
              </div>
              <OuterPanel className="md:ml-8 order-3">
                <InnerPanel className="p-5">
                  <div className="font-pixel text-[10px] uppercase text-gold mb-2">02</div>
                  <h3 className="font-pixel text-xs text-white text-shadow mb-3">Website &amp; Socials</h3>
                  <p className="font-body text-lg text-white/80 text-shadow leading-relaxed">
                    Lucky Frog lands on the web. X and Telegram communities open. The swamp fills up.
                  </p>
                </InnerPanel>
              </OuterPanel>
            </div>

            {/* 03 — Treasury Wallet */}
            <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
              <OuterPanel className="md:mr-8">
                <InnerPanel className="p-5 md:text-right">
                  <div className="font-pixel text-[10px] uppercase text-gold mb-2">03</div>
                  <h3 className="font-pixel text-xs text-white text-shadow mb-3">Treasury Wallet</h3>
                  <p className="font-body text-lg text-white/80 text-shadow leading-relaxed">
                    The mining treasury is established and funded to cover player claim payouts.
                  </p>
                </InnerPanel>
              </OuterPanel>
              <div className="z-10 mx-auto flex h-8 w-8 shrink-0 items-center justify-center border-4 border-neon bg-brown-100">
                <div className="h-2 w-2 bg-neon" />
              </div>
              <div className="flex items-center md:ml-8">
                <span className="font-pixel text-[9px] uppercase text-neon border-2 border-neon px-3 py-1">Done</span>
              </div>
            </div>

            {/* 04 — Mine When ??? — dimmed */}
            <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
              <div className="flex items-center md:justify-end md:mr-8 order-2 md:order-1">
                <span className="font-pixel text-[9px] uppercase text-brown-400 border-2 border-brown-300 px-3 py-1">Soon</span>
              </div>
              <div className="z-10 mx-auto flex h-8 w-8 shrink-0 items-center justify-center border-4 border-brown-300 bg-brown-100 order-1 md:order-2">
                <div className="h-2 w-2 bg-brown-400" />
              </div>
              <OuterPanel className="opacity-60 md:ml-8 order-3">
                <InnerPanel className="p-5">
                  <div className="font-pixel text-[10px] uppercase text-muted-foreground mb-2">04</div>
                  <h3 className="font-pixel text-xs text-white/60 text-shadow mb-3">Mine When ???</h3>
                  <p className="font-body text-lg text-white/50 text-shadow leading-relaxed">
                    The mining game goes live. Frogs dig. Crystals form. Chests are opened. Details drop when the swamp is ready.
                  </p>
                </InnerPanel>
              </OuterPanel>
            </div>

          </div>
        </section>

        {/* Frogverse */}
        <section id="frogverse" className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
          <div className="mb-12 text-center">
            <h2 className="font-pixel text-xl text-neon sm:text-2xl md:text-3xl">
              FROGVERSE
            </h2>
            <p className="mt-3 font-body text-base text-foreground/70 sm:text-lg md:text-xl">
              Every frog has a world. Welcome to the Frogverse.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <MemeCard
              image={IMAGES.moon}
              title="Frog Mooning"
              caption="One small leap for frog, one giant pump for swamp."
            />
            <MemeCard
              image={IMAGES.casino}
              title="Frog Casino"
              caption="House always loses to a crowned frog."
            />
            <MemeCard
              image={IMAGES.king}
              title="King Frog"
              caption="The swamp bends the knee. Long live the frog."
            />
            <MemeCard
              image={IMAGES.wizard}
              title="Wizard Frog"
              caption="Casts: Lucky Pump III. Mana cost: 1 SOL."
            />
          </div>
        </section>

        <GamePreview />

        <Leaderboard />

        {/* Token */}
        <section id="token" className="mx-auto max-w-5xl px-4 py-20 sm:px-8">
          <OuterPanel className="animate-pulse-glow">
            <InnerPanel className="p-6 sm:p-10">
              <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
                <div className="relative mx-auto">
                  <div className="absolute -inset-4 bg-gold/30 blur-2xl" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={IMAGES.frog}
                    alt="Lucky Frog token"
                    className="pixel-border-lg relative h-44 w-44 sm:h-52 sm:w-52"
                  />
                  <span className="absolute -right-2 -top-2 border-2 border-gold bg-card px-2 py-1 font-pixel text-[10px] text-gold text-glow-gold">
                    👑
                  </span>
                </div>
                <div>
                  <h2 className="font-pixel text-xl text-white text-shadow sm:text-2xl">
                    THE TOKEN
                  </h2>
                  <dl className="mt-6 grid grid-cols-1 gap-3 font-body text-xl xs:grid-cols-3 sm:grid-cols-3">
                    <div className="border-l-4 border-neon pl-3">
                      <dt className="font-pixel text-[10px] uppercase text-white/60">
                        Ticker
                      </dt>
                      <dd className="mt-1 text-neon text-shadow">$LFRG</dd>
                    </div>
                    <div className="border-l-4 border-gold pl-3">
                      <dt className="font-pixel text-[10px] uppercase text-white/60">
                        Name
                      </dt>
                      <dd className="mt-1 text-gold text-shadow">Lucky Frog</dd>
                    </div>
                    <div className="border-l-4 border-rose pl-3">
                      <dt className="font-pixel text-[10px] uppercase text-white/60">
                        Chain
                      </dt>
                      <dd className="mt-1 text-rose text-shadow">Solana</dd>
                    </div>
                  </dl>
                  <OuterPanel className="mt-5">
                    <InnerPanel className="p-3">
                      <div className="font-pixel text-[9px] uppercase text-white/70 text-shadow">
                        Contract Address
                      </div>
                      <div className="mt-1 break-all font-body text-base text-white text-shadow">
                        rguPVQY61jq14vwShEaNuSiCXYGG3bwWzwa3XJHpump
                      </div>
                    </InnerPanel>
                  </OuterPanel>
                  <p className="mt-5 font-body text-base text-white/70 text-shadow">
                    Created for entertainment and community purposes. Not
                    financial advice. Just frog vibes.
                  </p>
                </div>
              </div>
            </InnerPanel>
          </OuterPanel>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-brown-600 bg-brown-100">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
            <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={IMAGES.frog}
                  alt="Lucky Frog logo"
                  className="h-14 w-14 border-2 border-neon"
                />
                <div>
                  <div className="font-pixel text-sm text-neon text-glow">
                    LUCKY FROG
                  </div>
                  <div className="font-body text-base text-foreground/70">
                    Hold the frog. Trust the luck.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <PixelButton
                  variant="secondary"
                  href="https://x.com/luckyfrog_sol"
                  className="!text-[10px]"
                >
                  𝕏 Twitter
                </PixelButton>
                <PixelButton
                  variant="secondary"
              href="https://t.me/+lzWz4Cf677JmMDg1"
              >
                ✈ Telegram
              </PixelButton>
              <PixelButton
                variant="primary"
                href="https://pump.fun/coin/rguPVQY61jq14vwShEaNuSiCXYGG3bwWzwa3XJHpump"
                className="!text-[10px]"
              >
                🍀 Pump.fun
                </PixelButton>
              </div>
            </div>
            <div className="mt-8 border-t-2 border-brown-400 pt-6 text-center font-body text-base text-foreground/60">
              &copy; {new Date().getFullYear()} Lucky Frog &middot; $LFRG
              &middot; Ribbit responsibly 🐸
            </div>
          </div>
        </footer>
    </div>
  );
}

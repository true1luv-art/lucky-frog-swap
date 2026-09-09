"use client";

import { useState } from "react";
import { OuterPanel, InnerPanel } from "@/components/ui/Panel";

// ─── Data ────────────────────────────────────────────────────────────────────

const HOW_TO_PLAY = [
  {
    step: "01",
    icon: "🐸",
    title: "Register",
    desc: "Connect your Solana wallet to register. A starter frog is minted to your account — your first mining companion. One wallet per user, enforced.",
  },
  {
    step: "02",
    icon: "⛏",
    title: "Mine $LFRG",
    desc: "Your frogs mine automatically 24/7. Mining rate is driven by your frogs' Mining Power stat. Claim every 4 hours to collect your $LFRG.",
  },
  {
    step: "03",
    icon: "⏳",
    title: "Claim Every 4 Hours",
    desc: "Open your stash every 4 hours. Claim $LFRG to your wallet — or convert it to Charm to permanently increase your Crit stat.",
  },
  {
    step: "04",
    icon: "💎",
    title: "Get Shard Drops",
    desc: "Every claim triggers a shard drop. Based on your Luck stat, you receive shards of varying rarity. Collect 100 shards of the same rarity to combine into an Egg.",
  },
  {
    step: "05",
    icon: "🥚",
    title: "Open Eggs",
    desc: "Eggs contain new frog NFTs. Better eggs = higher chance at Rare, Epic, and Legendary frogs with higher Mining Power and Luck stats.",
  },
  {
    step: "06",
    icon: "⬆",
    title: "Level Up",
    desc: "Stake frogs to earn Frogments daily. Spend Frogments to level frogs up to 10× — boosting Mining Power up to 6.5× at max level.",
  },
];

const MECHANICS = [
  {
    title: "Mining Power",
    color: "neon",
    badge: "ACTIVE",
    icon: "⛏",
    desc: "The sum of all your frogs' Mining stat × their level multiplier. This is the only stat that drives how much $LFRG you earn per hour. Higher rarity frogs have larger Mining ranges.",
    detail: "Softcap at 333 — above that, each extra point gives 50% efficiency. Common mining: 1.10 base. Uncommon: 2.20. Rare: 3.30. Epic: 4.40. Legendary: 6.60.",
  },
  {
    title: "Luck",
    color: "gold",
    badge: "ACTIVE",
    icon: "🍀",
    desc: "Determines shard rarity on your 4hr claim drop and whether you receive an Egg drop instead. Hold ≥ 100,000 $LFRG for a +10 Luck hold bonus.",
    detail: "Egg drops trigger when your total Luck passes the roll threshold. Higher Luck = rarer shards and more frequent Egg drops. Max hold bonus: +10 Luck.",
  },
  {
    title: "Charm → Crit",
    color: "rose",
    badge: "FAVOR",
    icon: "🔥",
    desc: "Convert your mined $LFRG to Charm instead of claiming it. Charm is permanent and irrecoverable — it powers your Crit stat. A crit doubles your shard drop amount.",
    detail: "Max Charm: 1,000,000. Max Crit bonus: 50% (logarithmic curve). Formula: fraction of log(1 + charm) / log(1 + 1,000,000) × 50.",
  },
  {
    title: "Dodge",
    color: "accent",
    badge: "HOLD",
    icon: "🛡",
    desc: "Passive bonus from simply holding ≥ 100,000 $LFRG in your wallet at claim time. No staking, no locking. 100K is the cap — holding more does not increase the bonus. Reserved for PvP.",
    detail: "+5 Dodge from the hold bonus. Holding 100K $LFRG is the maximum threshold — bonus does not scale beyond that. No frog contribution — pure hold bonus.",
  },

  {
    title: "Level Multiplier",
    color: "neon",
    badge: "FROG",
    icon: "⬆",
    desc: "Leveling a frog multiplies its Mining and Luck contribution. Frogments come from salvaging duplicate frogs. Level 10 gives a 6.5× multiplier.",
    detail: "L1: 1.00×  L2: 1.15×  L3: 1.35×  L4: 1.60×  L5: 1.95×  L6: 2.40×  L7: 3.00×  L8: 3.80×  L9: 4.90×  L10: 6.50×",
  },
  {
    title: "Halving Schedule",
    color: "gold",
    badge: "SUPPLY",
    icon: "📉",
    desc: "Mine rate slows as the total frog supply grows. There are 4 phases tied to supply saturation. Currently in Phase 1 — the fastest mining era.",
    detail: "Phase 1 (0–25k minted): 8× rate. Phase 2 (25k–50k): 4× rate. Phase 3 (50k–75k): 2× rate. Phase 4 (75k–101k): base rate. Total supply cap: 101,000 frogs.",
  },
  {
    title: "One Wallet Rule",
    color: "rose",
    badge: "ENFORCED",
    icon: "🔒",
    desc: "One wallet per user, one account per IP address. Duplicate wallets or multi-accounting results in a permanent ban with no appeal. No exceptions.",
    detail: "Enforcement is at both wallet and IP level. A permanently banned account forfeits all frogs, $LFRG, and egg inventory. The ban is irreversible.",
  },
];

const DROP_RATES = [
  { rarity: "Common",    shard: "70%",   color: "text-white",       bar: 70   },
  { rarity: "Uncommon",  shard: "20%",   color: "text-neon",        bar: 20   },
  { rarity: "Rare",      shard: "8%",    color: "text-accent",      bar: 8    },
  { rarity: "Epic",      shard: "1.5%",  color: "text-rose",        bar: 1.5  },
  { rarity: "Legendary", shard: "0.5%",  color: "text-gold",        bar: 0.5  },
];

const EGGS = [
  {
    tier: "Common",
    price: "2,500",
    purchasable: true,
    color: "border-white/60 text-white",
    weights: { common: 90, uncommon: 9, rare: 0.75, epic: 0.20, legendary: 0.05 },
  },
  {
    tier: "Uncommon",
    price: "5,000",
    purchasable: true,
    color: "border-neon text-neon",
    featured: true,
    weights: { uncommon: 95, rare: 4, epic: 0.90, legendary: 0.10 },
  },
  {
    tier: "Rare",
    price: "10,000",
    purchasable: true,
    color: "border-accent text-accent",
    weights: { rare: 95, epic: 4, legendary: 1 },
  },
  {
    tier: "Epic",
    price: null,
    purchasable: false,
    color: "border-rose text-rose",
    weights: { epic: 98, legendary: 2 },
  },
  {
    tier: "Legendary",
    price: null,
    purchasable: false,
    color: "border-gold text-gold",
    weights: { legendary: 100 },
  },
];

const FROG_SUPPLY = [
  { rarity: "Common",    templates: 12, perTemplate: 5000,  total: 60000, color: "text-white"   },
  { rarity: "Uncommon",  templates: 10, perTemplate: 2500,  total: 25000, color: "text-neon"    },
  { rarity: "Rare",      templates:  8, perTemplate: 1500,  total: 12000, color: "text-accent"  },
  { rarity: "Epic",      templates:  6, perTemplate:  500,  total:  3000, color: "text-rose"    },
  { rarity: "Legendary", templates:  4, perTemplate:  250,  total:  1000, color: "text-gold"    },
];

const RARITY_COLORS: Record<string, string> = {
  common:    "text-white",
  uncommon:  "text-neon",
  rare:      "text-accent",
  epic:      "text-rose",
  legendary: "text-gold",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  if (active) {
    return (
      <OuterPanel>
        <InnerPanel className="px-4 py-2">
          <button
            onClick={onClick}
            className="font-pixel text-[9px] uppercase tracking-wide text-white text-shadow"
          >
            {children}
          </button>
        </InnerPanel>
      </OuterPanel>
    );
  }
  return (
    <button
      onClick={onClick}
      className="border-2 border-brown-600 bg-brown-200 px-4 py-2 font-pixel text-[9px] uppercase tracking-wide text-brown-700 transition-all duration-150 hover:border-brown-700 hover:bg-brown-300 hover:text-white hover:text-shadow"
    >
      {children}
    </button>
  );
}

function RarityBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-24 shrink-0 font-pixel text-[9px] ${color}`}>{label}</span>
      <div className="relative h-4 flex-1 border-2 border-brown-700 bg-brown-400/50">
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${Math.max(pct, 0.5)}%`,
            backgroundColor: `var(--color-${color.replace("text-", "")})`,
          }}
        />
      </div>
      <span className={`w-14 shrink-0 text-right font-pixel text-[9px] ${color}`}>
        {pct < 1 ? pct.toFixed(1) : pct}%
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "how-to-play" | "mechanics" | "drops" | "eggs";

export function GamePreview() {
  const [tab, setTab] = useState<Tab>("how-to-play");
  const [expandedMechanic, setExpandedMechanic] = useState<number | null>(null);

  return (
    <section id="game" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-8">
      {/* Section header */}
      <div className="mb-12 text-center">
        <h2 className="font-pixel text-xl text-foreground sm:text-2xl md:text-3xl">
          LUCKY FROG{" "}
          <span className="text-neon">MINE</span>
        </h2>
        <p className="mt-4 font-body text-xl text-brown-700 sm:text-2xl">
          A play-to-earn mining game built on $LFRG. Hold frogs. Mine tokens. Open eggs. Get lucky.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        <TabButton active={tab === "how-to-play"} onClick={() => setTab("how-to-play")}>
          How to Play
        </TabButton>
        <TabButton active={tab === "mechanics"} onClick={() => setTab("mechanics")}>
          Mechanics
        </TabButton>
        <TabButton active={tab === "drops"} onClick={() => setTab("drops")}>
          Drop Rates
        </TabButton>
        <TabButton active={tab === "eggs"} onClick={() => setTab("eggs")}>
          Egg Prices
        </TabButton>
      </div>

      {/* ── How to Play ── */}
      {tab === "how-to-play" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HOW_TO_PLAY.map((s) => (
            <div key={s.step} className="relative pt-5">
              {/* Step badge — OuterPanel tab style */}
              <div className="absolute -top-0 left-6 z-10">
                <OuterPanel className="!p-0">
                  <InnerPanel className="px-3 py-1">
                    <span className="font-pixel text-[9px] text-gold text-shadow">{s.step}</span>
                  </InnerPanel>
                </OuterPanel>
              </div>
              <OuterPanel>
                <InnerPanel className="h-full p-6 pt-8">
                  <div className="mb-3 text-3xl">{s.icon}</div>
                  <h3 className="font-pixel text-[11px] text-neon text-shadow">{s.title}</h3>
                  <p className="mt-3 font-body text-lg leading-relaxed text-white/80">{s.desc}</p>
                </InnerPanel>
              </OuterPanel>
            </div>
          ))}
        </div>
      )}

      {/* ── Mechanics ── */}
      {tab === "mechanics" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MECHANICS.map((m, i) => {
              const isOpen = expandedMechanic === i;
              const badgeColor =
                m.color === "neon"   ? "bg-neon text-white" :
                m.color === "gold"   ? "bg-gold text-white" :
                m.color === "rose"   ? "bg-rose text-white" :
                m.color === "accent" ? "bg-accent text-white" :
                "bg-brown-400 text-white";
              const titleColor =
                m.color === "neon"   ? "text-neon" :
                m.color === "gold"   ? "text-gold" :
                m.color === "rose"   ? "text-rose" :
                m.color === "accent" ? "text-accent" :
                "text-white";

              return (
                <div key={m.title} className="relative pt-3">
                  <span className={`absolute -top-0 right-4 z-10 px-2 py-1 font-pixel text-[8px] text-shadow ${badgeColor}`}>
                    {m.badge}
                  </span>
                  <OuterPanel>
                    <InnerPanel className="p-0">
                      <button
                        onClick={() => setExpandedMechanic(isOpen ? null : i)}
                        className="text-left p-5 pt-6 transition-all duration-150 hover:brightness-105 w-full"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{m.icon}</span>
                          <h3 className={`font-pixel text-[10px] text-shadow ${titleColor}`}>{m.title}</h3>
                        </div>
                        <p className="mt-3 font-body text-lg leading-relaxed text-white/80">{m.desc}</p>
                        {isOpen && (
                          <div className="mt-4 border-t-2 border-dashed border-brown-700 pt-4">
                            <p className="font-body text-base text-white">{m.detail}</p>
                          </div>
                        )}
                        <div className={`mt-3 font-pixel text-[8px] opacity-70 text-shadow ${titleColor}`}>
                          {isOpen ? "▲ less" : "▼ more"}
                        </div>
                      </button>
                    </InnerPanel>
                  </OuterPanel>
                </div>
              );
            })}
          </div>

          {/* Frog capacity */}
          <OuterPanel>
            <InnerPanel className="overflow-hidden p-0">
              <div className="border-b-2 border-brown-700 px-6 py-4 flex items-center gap-3">
                <span className="h-3 w-3 bg-gold" />
                <h3 className="font-pixel text-[11px] text-gold text-shadow">FROG WALLET CAPACITY</h3>
                <span className="h-3 w-3 bg-gold" />
              </div>
              <div className="p-6 flex flex-col gap-4">
                <p className="font-body text-lg text-white/80 leading-relaxed">
                  Every wallet can hold up to{" "}
                  <span className="font-pixel text-[10px] text-gold">1,000 frogs</span> — no purchasing required.
                </p>
                <div className="flex items-center justify-between border-2 border-gold/40 bg-gold/10 px-4 py-3">
                  <span className="font-pixel text-[9px] text-white/70 uppercase tracking-wide">Hard cap per wallet</span>
                  <span className="font-pixel text-[11px] text-gold text-shadow">1,000 frogs</span>
                </div>
                <div className="flex items-center justify-between border-2 border-neon/40 bg-neon/10 px-4 py-3">
                  <span className="font-pixel text-[9px] text-white/70 uppercase tracking-wide">Total frog supply</span>
                  <span className="font-pixel text-[11px] text-neon text-shadow">101,000 frogs</span>
                </div>
                <p className="font-pixel text-[8px] text-rose text-shadow">
                  One wallet per user. Multi-accounting = permanent ban. No appeal.
                </p>
              </div>
            </InnerPanel>
          </OuterPanel>

          {/* Frog supply table */}
          <OuterPanel>
            <InnerPanel className="overflow-hidden p-0">
              <div className="border-b-2 border-brown-700 px-6 py-4 flex items-center gap-3">
                <span className="h-3 w-3 bg-neon" />
                <h3 className="font-pixel text-[11px] text-neon text-shadow">FROG SUPPLY — FIXED FOREVER</h3>
                <span className="h-3 w-3 bg-neon" />
              </div>
              <div className="p-6">
                <p className="font-body text-lg text-white/80 leading-relaxed mb-4">
                  Total supply is hard-capped at <span className="font-pixel text-[10px] text-gold">101,000 frogs</span>. Once minted, no new frogs can ever be created beyond its limit.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-4 border-brown-700">
                        <th className="py-2 pr-4 text-left font-pixel text-[8px] text-white/60">RARITY</th>
                        <th className="py-2 pr-4 text-left font-pixel text-[8px] text-white/60">TEMPLATES</th>
                        <th className="py-2 pr-4 text-left font-pixel text-[8px] text-white/60">PER TEMPLATE</th>
                        <th className="py-2 text-left font-pixel text-[8px] text-white/60">TOTAL SUPPLY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FROG_SUPPLY.map((r) => (
                        <tr key={r.rarity} className="border-b-2 border-brown-700/50">
                          <td className={`py-2 pr-4 font-pixel text-[9px] text-shadow ${r.color}`}>{r.rarity}</td>
                          <td className="py-2 pr-4 font-pixel text-[9px] text-white">{r.templates}</td>
                          <td className="py-2 pr-4 font-pixel text-[9px] text-white/60">{r.perTemplate.toLocaleString()}</td>
                          <td className={`py-2 font-pixel text-[9px] text-shadow ${r.color}`}>{r.total.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="border-t-4 border-brown-700 bg-gold/10">
                        <td className="py-2 pr-4 font-pixel text-[9px] text-gold text-shadow">TOTAL</td>
                        <td className="py-2 pr-4 font-pixel text-[9px] text-white">40</td>
                        <td className="py-2 pr-4 font-pixel text-[8px] text-white/60">—</td>
                        <td className="py-2 font-pixel text-[9px] text-gold text-shadow">101,000 <span className="text-[7px]">MAX</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </InnerPanel>
          </OuterPanel>
        </div>
      )}

      {/* ── Drop Rates ── */}
      {tab === "drops" && (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Shard drops */}
          <OuterPanel>
            <InnerPanel className="p-6">
              <div className="mb-6 flex items-center gap-3">
                <span className="text-2xl">💎</span>
                <div>
                  <h3 className="font-pixel text-[11px] text-neon text-shadow">Shard Drop Rates</h3>
                  <p className="mt-1 font-body text-base text-white/70">Base weights — shifted toward rarer shards by your Luck stat. Collect 100 of the same rarity to combine into an Egg.</p>
                </div>
              </div>
              <div className="space-y-3">
                {DROP_RATES.map((r) => (
                  <RarityBar key={r.rarity} label={r.rarity} pct={r.bar} color={r.color} />
                ))}
              </div>
              <div className="mt-6 border-2 border-dashed border-brown-700 bg-brown-400/30 p-4">
                <p className="font-pixel text-[8px] text-gold text-shadow">SHARD COMBINE</p>
                <p className="mt-2 font-body text-base text-white/80">
                  Collect 100 shards of the same rarity → combine them into an Egg of the matching tier. The only way to obtain Epic and Legendary Eggs.
                </p>
              </div>
            </InnerPanel>
          </OuterPanel>

          {/* Luck and Crit */}
          <div className="flex flex-col gap-4">
            <OuterPanel>
              <InnerPanel className="p-6">
                <h3 className="font-pixel text-[11px] text-gold text-shadow">Luck — Egg vs Shard</h3>
                <p className="mt-3 font-body text-lg text-white/80 leading-relaxed">
                  Every 4hr claim rolls against your total Luck stat. If the roll passes (and Luck ≥ 10) — you get an Egg. Otherwise — you get Shards.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  {[
                    { label: "Min Luck for Egg", value: "10+",  sub: "Required threshold" },
                    { label: "≥ 100K Hold",       value: "+10", sub: "Luck hold bonus" },
                  ].map((s) => (
                    <OuterPanel key={s.label} className="!p-0">
                      <InnerPanel className="p-2">
                        <div className="font-pixel text-[8px] text-white/70">{s.label}</div>
                        <div className="mt-1 font-pixel text-sm text-gold text-shadow">{s.value}</div>
                        <div className="font-body text-sm text-white/60">{s.sub}</div>
                      </InnerPanel>
                    </OuterPanel>
                  ))}
                </div>
                <p className="mt-3 font-pixel text-[8px] text-white/60">100K $LFRG held is the cap — holding more does not increase luck further.</p>
              </InnerPanel>
            </OuterPanel>

            <OuterPanel>
              <InnerPanel className="p-6">
                <h3 className="font-pixel text-[11px] text-rose text-shadow">{"Charm \u2014 Crit Bonus"}</h3>
                <p className="mt-4 font-body text-lg text-white/80 leading-relaxed">
                  Convert mined $LFRG to Charm instead of claiming. Charm permanently increases your Crit stat. A crit on a drop doubles your shard amount.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "1K Charm",   value: "~0.5%", sub: "Crit chance" },
                    { label: "100K Charm", value: "~23%",  sub: "Crit chance" },
                    { label: "1M Charm",   value: "50%",   sub: "Crit cap" },
                  ].map((s) => (
                    <OuterPanel key={s.label} className="!p-0">
                      <InnerPanel className="p-2">
                        <div className="font-pixel text-[8px] text-white/70">{s.label}</div>
                        <div className="mt-1 font-pixel text-sm text-rose text-shadow">{s.value}</div>
                        <div className="font-body text-sm text-white/60">{s.sub}</div>
                      </InnerPanel>
                    </OuterPanel>
                  ))}
                </div>
              </InnerPanel>
            </OuterPanel>

            <OuterPanel>
              <InnerPanel className="p-6">
                <h3 className="font-pixel text-[11px] text-accent text-shadow">Egg Tier from Luck</h3>
                <p className="mt-3 font-body text-lg text-white/80 leading-relaxed">
                  When an Egg drop triggers, your total Luck determines the tier. Higher Luck pushes toward rarer eggs.
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    { range: "Luck ≥ 90", tier: "Legendary Egg", color: "text-gold" },
                    { range: "Luck ≥ 75", tier: "Epic Egg",      color: "text-rose" },
                    { range: "Luck ≥ 50", tier: "Rare Egg",      color: "text-accent" },
                    { range: "Luck ≥ 20", tier: "Uncommon Egg",  color: "text-neon" },
                    { range: "Luck ≥ 10", tier: "Common Egg",    color: "text-white" },
                  ].map((e) => (
                    <div key={e.range} className="flex items-center justify-between border-b border-brown-700/40 pb-2">
                      <span className="font-pixel text-[8px] text-white/60">{e.range}</span>
                      <span className={`font-pixel text-[8px] text-shadow ${e.color}`}>{e.tier}</span>
                    </div>
                  ))}
                </div>
              </InnerPanel>
            </OuterPanel>
          </div>
        </div>
      )}

      {/* ── Egg Prices ── */}
      {tab === "eggs" && (
        <div className="space-y-6">
          {/* Purchasable row */}
          <div>
            <p className="mb-3 font-pixel text-[9px] text-neon text-shadow">PURCHASABLE WITH $LFRG</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {EGGS.filter((e) => e.purchasable).map((e) => (
                <div key={e.tier} className="relative pt-3">
                  {"featured" in e && e.featured && (
                    <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                      <OuterPanel className="!p-0">
                        <InnerPanel className="px-2 py-0.5">
                          <span className="font-pixel text-[7px] text-neon text-shadow">POPULAR</span>
                        </InnerPanel>
                      </OuterPanel>
                    </div>
                  )}
                  <OuterPanel>
                    <InnerPanel className="flex flex-col gap-3 p-5">
                      <div className="mx-auto">
                        <div
                          className={`h-10 w-8 border-4 ${e.color.split(" ")[0]}`}
                          style={{ borderRadius: "50% 50% 40% 40% / 60% 60% 40% 40%" }}
                        />
                      </div>
                      <h3 className={`text-center font-pixel text-[11px] text-shadow ${e.color.split(" ")[1]}`}>{e.tier} Egg</h3>
                      <div className="text-center">
                        <span className="font-pixel text-sm text-white text-shadow">{e.price}</span>
                        <span className="ml-1 font-pixel text-[8px] text-white/60">$LFRG</span>
                      </div>
                      <div className="text-center">
                        <span className="font-pixel text-[9px] text-neon text-shadow">1 frog card</span>
                      </div>
                      <div className="border-t-2 border-dashed border-brown-700 pt-3 space-y-1.5">
                        {Object.entries(e.weights).map(([rarity, pct]) => (
                          <div key={rarity} className="flex items-center justify-between">
                            <span className={`font-pixel text-[7px] ${RARITY_COLORS[rarity]}`}>{rarity}</span>
                            <span className={`font-pixel text-[7px] ${RARITY_COLORS[rarity]}`}>{pct}%</span>
                          </div>
                        ))}
                      </div>
                    </InnerPanel>
                  </OuterPanel>
                </div>
              ))}
            </div>
          </div>

          {/* Drop-only row */}
          <div>
            <p className="mb-3 font-pixel text-[9px] text-gold text-shadow">DROP ONLY — COMBINE 100 SHARDS TO EARN</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {EGGS.filter((e) => !e.purchasable).map((e) => (
                <OuterPanel key={e.tier} className="relative opacity-90">
                  <InnerPanel className="flex flex-col gap-3 p-5">
                    <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-brown-700/40 rounded-xl" />
                    <div className="mx-auto">
                      <div
                        className={`h-10 w-8 border-4 border-dashed ${e.color.split(" ")[0]}`}
                        style={{ borderRadius: "50% 50% 40% 40% / 60% 60% 40% 40%" }}
                      />
                    </div>
                    <h3 className={`text-center font-pixel text-[11px] text-shadow ${e.color.split(" ")[1]}`}>{e.tier} Egg</h3>
                    <div className="text-center">
                      <span className="font-pixel text-[9px] text-white/60">Shard Combine Only</span>
                    </div>
                    <div className="text-center">
                      <span className="font-pixel text-[9px] text-neon text-shadow">1 frog card</span>
                    </div>
                    <div className="border-t-2 border-dashed border-brown-700 pt-3 space-y-1.5">
                      {Object.entries(e.weights).map(([rarity, pct]) => (
                        <div key={rarity} className="flex items-center justify-between">
                          <span className={`font-pixel text-[7px] ${RARITY_COLORS[rarity]}`}>{rarity}</span>
                          <span className={`font-pixel text-[7px] ${RARITY_COLORS[rarity]}`}>{pct}%</span>
                        </div>
                      ))}
                    </div>
                  </InnerPanel>
                </OuterPanel>
              ))}
            </div>
          </div>

          {/* Info panels */}
          <OuterPanel>
            <InnerPanel className="p-6">
              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <h4 className="font-pixel text-[10px] text-neon text-shadow">3 Purchasable Tiers</h4>
                  <p className="mt-2 font-body text-lg text-white/80 leading-relaxed">
                    Common (2,500), Uncommon (5,000) and Rare (10,000) eggs are bought with $LFRG. Epic and Legendary can only be earned via shard combines — never bought.
                  </p>
                </div>
                <div>
                  <h4 className="font-pixel text-[10px] text-gold text-shadow">Crit = Second Frog</h4>
                  <p className="mt-2 font-body text-lg text-white/80 leading-relaxed">
                    If your Crit roll fires at egg open time, you receive a second frog card from the same egg. Stack Charm to increase your Crit chance up to 50%.
                  </p>
                </div>
                <div>
                  <h4 className="font-pixel text-[10px] text-rose text-shadow">Shard Combine</h4>
                  <p className="mt-2 font-body text-lg text-white/80 leading-relaxed">
                    Collect 100 shards of the same rarity to combine them into a matching egg. The only way to obtain Epic and Legendary eggs — impossible to buy.
                  </p>
                </div>
              </div>
            </InnerPanel>
          </OuterPanel>

          {/* Token distribution */}
          <OuterPanel>
            <InnerPanel className="overflow-hidden p-0">
              <div className="border-b-2 border-brown-700 px-6 py-4 flex items-center gap-3">
                <span className="h-3 w-3 bg-gold" />
                <h3 className="font-pixel text-[11px] text-gold text-shadow">EGG PURCHASE — TOKEN FLOW</h3>
                <span className="h-3 w-3 bg-gold" />
              </div>
              <div className="px-6 pt-6">
                <div className="flex h-10 w-full overflow-hidden border-4 border-brown-700">
                  <div className="flex h-full items-center justify-center bg-neon transition-all" style={{ width: "60%" }}>
                    <span className="font-pixel text-[9px] text-white text-shadow">60%</span>
                  </div>
                  <div className="flex h-full items-center justify-center bg-rose transition-all" style={{ width: "20%" }}>
                    <span className="font-pixel text-[9px] text-white text-shadow">20%</span>
                  </div>
                  <div className="flex h-full items-center justify-center bg-gold transition-all" style={{ width: "20%" }}>
                    <span className="font-pixel text-[9px] text-white text-shadow">20%</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-0 sm:grid-cols-3 p-6 pt-5">
                <div className="flex flex-col gap-2 border-r-0 sm:border-r-2 border-brown-700 pr-0 sm:pr-6">
                  <div className="flex items-center gap-3">
                    <span className="h-4 w-4 shrink-0 bg-neon" />
                    <span className="font-pixel text-[9px] text-neon text-shadow">60% — Mining Treasury</span>
                  </div>
                  <p className="font-body text-lg text-white/80 leading-relaxed">
                    Goes directly into the mining treasury wallet. This is the reserve that funds every $LFRG claim payout.
                  </p>
                  <div className="mt-4 border-2 border-dashed border-neon/50 bg-neon/10 p-3">
                    <div className="font-pixel text-[8px] uppercase text-neon/70 mb-1">Treasury Wallet</div>
                    <div className="break-all font-body text-sm text-white">Eka1aTLUgrRv4uE5htxHYpaRrZTeKRdDH2UWjsCRP1TD</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-r-0 sm:border-r-2 border-brown-700 px-0 sm:px-6 mt-5 sm:mt-0 border-t-2 sm:border-t-0 border-brown-700 pt-5 sm:pt-0">
                  <div className="flex items-center gap-3">
                    <span className="h-4 w-4 shrink-0 bg-rose" />
                    <span className="font-pixel text-[9px] text-rose text-shadow">20% — Burned</span>
                  </div>
                  <p className="font-body text-lg text-white/80 leading-relaxed">
                    Permanently removed from circulation. Every egg purchase reduces the total $LFRG supply, creating sustained deflation as the game grows.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pl-0 sm:pl-6 mt-5 sm:mt-0 border-t-2 sm:border-t-0 border-brown-700 pt-5 sm:pt-0">
                  <div className="flex items-center gap-3">
                    <span className="h-4 w-4 shrink-0 bg-gold" />
                    <span className="font-pixel text-[9px] text-gold text-shadow">20% — Leaderboard Rewards</span>
                  </div>
                  <p className="font-body text-lg text-white/80 leading-relaxed">
                    Pooled into the leaderboard reward pot. Distributed to top miners and holders at the end of each season cycle.
                  </p>
                </div>
              </div>
            </InnerPanel>
          </OuterPanel>
        </div>
      )}
    </section>
  );
}

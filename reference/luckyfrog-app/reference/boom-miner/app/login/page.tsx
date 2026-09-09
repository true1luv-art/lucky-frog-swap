import Link from "next/link";
import type { CSSProperties } from "react";
import { LoginSolana }    from "@/components/login/LoginSolana";
import { LoginRobinhood } from "@/components/login/LoginRobinhood";
import { LoginHive }      from "@/components/login/LoginHive";

// ---------------------------------------------------------------------------
// Chain is read server-side from the environment so the correct panel is
// rendered on the initial response — no layout shift, no client guess.
// When NEXT_PUBLIC_CHAIN is absent or "none" the game is not yet live.
// ---------------------------------------------------------------------------
const rawChain = (process.env.NEXT_PUBLIC_CHAIN ?? "").toLowerCase().trim();
const chain    = rawChain === "" || rawChain === "none" ? "none" : rawChain;

const pixelFont = "'Press Start 2P', monospace";
const bodyFont  = "'VT323', monospace";
const gold      = "#facc15";
const cream     = "#f5e9c4";
const bg        = "#0a0a0a";
const hairline  = "rgba(245,233,196,0.15)";

// Per-chain copy
const CHAIN_COPY: Record<string, { label: string; tagline: string; bullets: string[] }> = {
  solana: {
    label:   "SOLANA",
    tagline: "Connect your Solana wallet to claim your pixel miners, stack $BMCOIN, and climb the global leaderboards.",
    bullets: [
      "Works with Phantom, Solflare, Backpack and more",
      "Gasless — you only sign a message, nothing is broadcast",
      "Server-authoritative $BMCOIN balance",
    ],
  },
  robinhood: {
    label:   "ROBINHOOD CHAIN",
    tagline: "Connect your Robinhood Chain wallet to enter the mines and earn $BMCOIN.",
    bullets: [
      "Works with MetaMask, Rabby and any EIP-6963 wallet",
      "Sign-in is free — no gas, no transaction",
      "Persistent stage progression across devices",
    ],
  },
  hive: {
    label:   "HIVE BLOCKCHAIN",
    tagline: "Sign in with your Hive account via Hive Keychain to enter the mines.",
    bullets: [
      "Requires the Hive Keychain browser extension",
      "Signs with your Posting key — no tokens spent",
      "Cross-device progress via server persistence",
    ],
  },
};

const COMING_SOON_COPY = {
  label:   "BOOM MINER",
  tagline: "A pixel mining game powered by blockchain. Deploy your heroes, detonate bombs, and stack coins.",
  bullets: [
    "Ten unique heroes across multiple rarities",
    "Real on-chain coin withdrawals",
    "Compete on global leaderboards",
  ],
};

const copy = chain === "none" ? COMING_SOON_COPY : (CHAIN_COPY[chain] ?? CHAIN_COPY.solana);

const chip: CSSProperties = {
  display: "inline-block", fontFamily: pixelFont, fontSize: 10,
  color: gold, border: `2px solid ${gold}`, padding: "6px 10px",
  letterSpacing: 2, marginRight: 8,
};

function Bullet({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: bodyFont, fontSize: 20, color: cream }}>
      <span style={{ width: 14, height: 14, background: gold, transform: "rotate(45deg)", display: "inline-block", flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
}

function ComingSoonPanel() {
  return (
    <div
      style={{
        border: `2px solid ${hairline}`,
        padding: "48px 36px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        textAlign: "center",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontFamily: pixelFont, fontSize: 11, color: gold, letterSpacing: 3 }}>
        COMING SOON
      </div>
      <p style={{ fontFamily: bodyFont, fontSize: 22, color: cream, opacity: 0.7, maxWidth: 300, lineHeight: 1.6, margin: 0 }}>
        The mines are not open yet. Stay tuned for the official launch announcement.
      </p>
      <div
        style={{
          width: 48, height: 6,
          background: gold,
          boxShadow: `4px 4px 0 #000`,
        }}
      />
      <p style={{ fontFamily: bodyFont, fontSize: 18, color: cream, opacity: 0.45, margin: 0 }}>
        Sign-in is disabled until launch.
      </p>
    </div>
  );
}

function LoginPanel() {
  if (chain === "none")      return <ComingSoonPanel />;
  if (chain === "hive")      return <LoginHive />;
  if (chain === "robinhood") return <LoginRobinhood />;
  return <LoginSolana />;
}

export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", background: bg, color: cream, fontFamily: pixelFont }}>
      <style>{`
        .bm-login-grid {
          max-width: 1180px;
          margin: 0 auto;
          padding: 80px 28px 120px;
          display: grid;
          grid-template-columns: minmax(0,1.05fr) minmax(0,0.95fr);
          gap: 72px;
          align-items: center;
        }
        @media (max-width: 900px) {
          .bm-login-grid {
            grid-template-columns: 1fr;
            gap: 40px;
            padding: 48px 20px 72px;
          }
        }
      `}</style>
      {/* NAV */}
      <nav style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px dashed ${hairline}` }}>
        <Link href="/" style={{ fontFamily: pixelFont, fontSize: 12, color: cream, letterSpacing: 2, textDecoration: "none" }}>
          BOOM MINER
        </Link>
        <Link href="/" style={{ fontFamily: pixelFont, fontSize: 10, color: cream, textDecoration: "none", letterSpacing: 2, opacity: 0.75 }}>
          ← BACK
        </Link>
      </nav>

      <section className="bm-login-grid">
        {/* LORE SIDE */}
        <div>
          <div style={{ marginBottom: 24 }}>
            <span style={chip}>{copy.label}</span>
            <span style={chip}>$BMCOIN</span>
          </div>
          <h1 style={{ fontFamily: pixelFont, fontSize: "clamp(36px, 5vw, 60px)", lineHeight: 1.15, margin: 0, color: cream, textShadow: "5px 5px 0 #000", letterSpacing: -1 }}>
            ENTER THE<br />MINES
          </h1>
          <p style={{ fontFamily: bodyFont, fontSize: 22, marginTop: 26, maxWidth: 460, lineHeight: 1.55, color: cream, opacity: 0.75 }}>
            {copy.tagline}
          </p>
          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 18 }}>
            {copy.bullets.map((b) => <Bullet key={b} label={b} />)}
          </div>
        </div>

        {/* LOGIN CARD — chain determined at server render time */}
        <div>
          <LoginPanel />
        </div>
      </section>
    </main>
  );
}

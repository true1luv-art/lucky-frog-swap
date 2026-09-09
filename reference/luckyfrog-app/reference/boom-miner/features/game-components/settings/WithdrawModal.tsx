"use client";

import { useEffect, useRef, useState } from "react";
import {
  ModalShell,
  ModalTitleBar,
  ActionDock,
  SectionLabel,
  StatChip,
} from "@/components/ui/modal";
import { useGameStore } from "@/features/store/gameStore";

const PIXEL_HEAD = "'Press Start 2P', 'Silkscreen', monospace";
const PIXEL_BODY = "'VT323', 'Silkscreen', monospace";

// ---------------------------------------------------------------------------
// Chain-aware explorer and copy strings.
// NEXT_PUBLIC_CHAIN is evaluated at build time in Next.js (process.env is
// inlined), so it is always available in client components without a fetch.
// ---------------------------------------------------------------------------
const ACTIVE_CHAIN = (process.env.NEXT_PUBLIC_CHAIN ?? "solana").toLowerCase();

const EXPLORER_BASE: Record<string, string> = {
  solana:    "https://solscan.io/tx/",
  robinhood: "https://robinhoodchain.blockscout.com/tx/",
  hive:      "https://hiveblocks.com/tx/",
};

const CHAIN_LABEL: Record<string, string> = {
  solana:    "Solana",
  robinhood: "Robinhood Chain",
  hive:      "Hive",
};

const explorerBase = EXPLORER_BASE[ACTIVE_CHAIN] ?? EXPLORER_BASE.solana;
const chainLabel   = CHAIN_LABEL[ACTIVE_CHAIN]   ?? "the blockchain";

/** Poll cadence + ceiling while waiting for the settlement worker. */
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 20;

type Phase = "idle" | "submitting" | "pending" | "done" | "error";

interface ProcessedTx {
  txHash: string;
  wallet: string;
  type: string;
  amount: number;
  processedAt: number;
}

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return n.toString();
}

function shortSig(sig: string): string {
  return sig.length > 16 ? `${sig.slice(0, 8)}…${sig.slice(-6)}` : sig;
}

/**
 * Dev-only initial state, used by /test-modals to preview flow phases
 * without a live server. Never pass this in production paths.
 */
export interface WithdrawDebugInitial {
  phase?: Phase;
  amount?: string;
  error?: string;
  settledSig?: string;
}

interface Props {
  show: boolean;
  onClose: () => void;
  debugInitial?: WithdrawDebugInitial;
}

export function WithdrawModal({ show, onClose, debugInitial }: Props) {
  const coins = useGameStore((s) => s.coins);
  const reconcile = useGameStore((s) => s.reconcile);

  const [amount, setAmount] = useState<string>(debugInitial?.amount ?? "");
  const [phase, setPhase] = useState<Phase>(debugInitial?.phase ?? "idle");
  const [error, setError] = useState<string | null>(debugInitial?.error ?? null);
  const [settledSig, setSettledSig] = useState<string | null>(debugInitial?.settledSig ?? null);

  // Track polling so we can cancel on unmount / close.
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineSig = useRef<string | null>(null);

  const numeric = Number(amount);
  const validAmount =
    Number.isInteger(numeric) && numeric >= 1 && numeric <= coins;

  const stopPolling = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  // Clean up any in-flight poll when the modal unmounts.
  useEffect(() => stopPolling, []);

  const token = () =>
    typeof window !== "undefined" ? localStorage.getItem("bm_token") : null;

  const authHeaders = (): Record<string, string> => {
    const t = token();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  /** Fetch the newest withdrawal signature for this wallet (or null). */
  const fetchLatestSig = async (): Promise<string | null> => {
    const res = await fetch("/api/transactions?type=withdrawal&limit=1", {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success: boolean;
      transactions?: ProcessedTx[];
    };
    return data.transactions?.[0]?.txHash ?? null;
  };

  const pollForSettlement = (tries: number) => {
    pollTimer.current = setTimeout(async () => {
      const latest = await fetchLatestSig();
      // A new signature (different from the baseline) means our withdrawal settled.
      if (latest && latest !== baselineSig.current) {
        setSettledSig(latest);
        setPhase("done");
        // Server already debited; mirror it locally so the HUD balance updates.
        reconcile({ coins: Math.max(0, coins - numeric) });
        stopPolling();
        return;
      }
      if (tries + 1 >= POLL_MAX_TRIES) {
        // Timed out waiting — it's queued and will still settle server-side.
        setPhase("pending");
        stopPolling();
        return;
      }
      pollForSettlement(tries + 1);
    }, POLL_INTERVAL_MS);
  };

  const handleWithdraw = async () => {
    if (!validAmount || phase === "submitting" || phase === "pending") return;
    setPhase("submitting");
    setError(null);
    setSettledSig(null);

    try {
      // Capture the current newest signature so we can detect the new one.
      baselineSig.current = await fetchLatestSig();

      const res = await fetch("/api/bank/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ amount: numeric }),
      });
      const data = (await res.json()) as {
        success: boolean;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.success) {
        setError(
          data.code === "INSUFFICIENT_COINS"
            ? "Not enough $BMCOIN"
            : data.code === "EXCEEDS_LIMIT"
              ? "Daily withdrawal limit reached"
              : (data.error ?? "Withdrawal failed"),
        );
        setPhase("error");
        return;
      }

      // Queued — wait for the settlement worker to broadcast the transfer.
      setPhase("pending");
      pollForSettlement(0);
    } catch {
      setError("Network error — please try again");
      setPhase("error");
    }
  };

  const busy = phase === "submitting" || phase === "pending";

  const setPct = (pct: number) => {
    setAmount(String(Math.floor((coins * pct) / 100)));
  };

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  return (
    <ModalShell
      show={show}
      onClose={handleClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          title="Withdraw"
          subtitle={`Cash out $BMCOIN to ${chainLabel}`}
          onClose={handleClose}
          extra={
            <StatChip
              icon="/assets/token.png"
              value={formatCoins(coins)}
              caption="$BMCOIN"
            />
          }
        />
      }
      actionDock={
        <ActionDock
          info={
            error ? (
              <span
                className="text-red-400"
                style={{ fontFamily: PIXEL_HEAD, fontSize: 8 }}
              >
                {error}
              </span>
            ) : (
              <span
                className="text-white/50"
                style={{ fontFamily: PIXEL_HEAD, fontSize: 8 }}
              >
                {formatCoins(coins)} available
              </span>
            )
          }
        >
          <button
            type="button"
            disabled={!validAmount || busy}
            onClick={handleWithdraw}
            className="wood-frame-light wood-panel-inner px-5 py-2 text-white text-shadow cursor-pointer hover:brightness-110 active:translate-y-0.5 transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              fontFamily: PIXEL_HEAD,
              fontSize: 9,
              letterSpacing: 2,
              boxShadow: validAmount && !busy ? "0 0 0 3px #16a34a" : undefined,
            }}
          >
            {phase === "submitting"
              ? "SENDING..."
              : phase === "pending"
                ? "SETTLING..."
                : "WITHDRAW"}
          </button>
        </ActionDock>
      }
    >
      <div className="flex flex-col gap-4 p-2">
        {/* Amount entry */}
        <div>
          <SectionLabel className="mb-2">Amount</SectionLabel>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={coins}
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-black/40 px-3 py-2 rounded text-white outline-none focus:brightness-110 disabled:opacity-60"
            style={{ fontFamily: PIXEL_BODY, fontSize: 22 }}
          />
          <div className="flex gap-2 mt-2">
            {[25, 50, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={busy || coins < 1}
                onClick={() => setPct(pct)}
                className="wood-frame-light wood-panel-inner flex-1 py-1.5 text-white text-shadow cursor-pointer hover:brightness-110 active:translate-y-0.5 transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: PIXEL_HEAD, fontSize: 8 }}
              >
                {pct === 100 ? "MAX" : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="flex justify-between items-center bg-black/40 px-3 py-2 rounded">
          <span
            style={{
              fontFamily: PIXEL_HEAD,
              fontSize: 8,
              color: "#777",
              letterSpacing: 1,
            }}
          >
            YOU RECEIVE
          </span>
          <span
            style={{
              fontFamily: PIXEL_BODY,
              fontSize: 20,
              color: validAmount ? "#fbbf24" : "#dc2626",
            }}
          >
            {Number.isFinite(numeric) && numeric > 0 ? formatCoins(numeric) : "0"} $BMCOIN
          </span>
        </div>

        {/* Status panel */}
        {phase === "pending" && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded bg-black/30"
            aria-live="polite"
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: "#facc15" }}
            />
            <span style={{ fontFamily: PIXEL_BODY, fontSize: 16, color: "#facc15" }}>
              Queued — settling on-chain. This can take a moment...
            </span>
          </div>
        )}

        {phase === "done" && settledSig && (
          <div
            className="flex flex-col gap-1 px-3 py-2 rounded bg-black/30"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: "#4ade80" }}
              />
              <span style={{ fontFamily: PIXEL_BODY, fontSize: 16, color: "#4ade80" }}>
                Withdrawal complete!
              </span>
            </div>
            <a
              href={`${explorerBase}${settledSig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:brightness-125 underline"
              style={{ fontFamily: PIXEL_BODY, fontSize: 14, color: "#93c5fd" }}
            >
              {shortSig(settledSig)}
            </a>
          </div>
        )}

        <p style={{ fontFamily: PIXEL_BODY, fontSize: 14, color: "#777" }}>
          Tokens are sent to your connected wallet by the treasury. Settlement is
          processed off-chain and confirmed on {chainLabel}.
        </p>
      </div>
    </ModalShell>
  );
}

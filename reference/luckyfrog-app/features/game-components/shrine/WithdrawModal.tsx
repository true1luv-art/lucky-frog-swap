"use client";

import { useEffect, useRef, useState } from "react";
import { ModalShell, ModalTitleBar, ActionDock, SectionLabel } from "@/components/ui/modal";
import { useGameStore } from "@/features/game-stores/useGameStore";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TOKEN_NAME =
  process.env.NEXT_PUBLIC_TOKEN_NAME ?? "$LFRG";

const EXPLORER_BASE = "https://robinhoodchain.blockscout.com/tx/";

const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_TRIES   = 20;

const shrineIcon = "/assets/icons/token.png";
const tokenIcon  = "/assets/icons/token.png";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return n.toString();
}

function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;
}

interface ProcessedTx { txHash: string; type: string; amount: number; processedAt: number; }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "idle" | "submitting" | "pending" | "done" | "error";

interface Props {
  show: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WithdrawModal({ show, onClose }: Props) {
  const coinsRaw           = useGameStore((s) => s.state.coins);
  const reconcileServer    = useGameStore((s) => s.reconcileServerState);

  // Coins may arrive as a plain number (JSON) or Decimal
  const coins = Number(coinsRaw ?? 0);

  const [amount,     setAmount]     = useState<string>("");
  const [phase,      setPhase]      = useState<Phase>("idle");
  const [error,      setError]      = useState<string | null>(null);
  const [settledSig, setSettledSig] = useState<string | null>(null);

  const pollTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineSig  = useRef<string | null>(null);

  const numeric    = Number(amount);
  const validAmount =
    Number.isFinite(numeric) &&
    Number.isInteger(numeric) &&
    numeric >= 1 &&
    numeric <= coins;

  // Reset on open
  useEffect(() => {
    if (show) {
      setAmount("");
      setPhase("idle");
      setError(null);
      setSettledSig(null);
    }
  }, [show]);

  const stopPolling = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const authHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const t = localStorage.getItem("bm_token") ?? localStorage.getItem("auth_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const fetchLatestSig = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/transactions?type=withdrawal&limit=1", {
        headers: { ...authHeaders() },
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json() as { transactions?: ProcessedTx[] };
      return data.transactions?.[0]?.txHash ?? null;
    } catch { return null; }
  };

  const pollForSettlement = (tries: number) => {
    pollTimer.current = setTimeout(async () => {
      const latest = await fetchLatestSig();
      if (latest && latest !== baselineSig.current) {
        setSettledSig(latest);
        setPhase("done");
        // Mirror deduction locally so coins HUD updates immediately
        void (async () => {
          const res = await fetch("/api/farm", { credentials: "include" });
          if (res.ok) {
            const json = await res.json() as { success?: boolean; state?: unknown };
            if (json.success && json.state) {
              reconcileServer(json.state as Parameters<typeof reconcileServer>[0]);
            }
          }
        })();
        stopPolling();
        return;
      }
      if (tries + 1 >= POLL_MAX_TRIES) {
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
      baselineSig.current = await fetchLatestSig();

      const res = await fetch("/api/bank/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ amount: numeric }),
      });
      const data = await res.json() as { success?: boolean; error?: string; code?: string };

      if (!res.ok || !data.success) {
        setError(
          data.code === "INSUFFICIENT_COINS"   ? "Not enough coins" :
          data.code === "WITHDRAWALS_DISABLED"  ? "Withdrawals are currently disabled" :
          data.code === "EXCEEDS_LIMIT"         ? "Daily withdrawal limit reached" :
          (data.error ?? "Withdrawal failed"),
        );
        setPhase("error");
        return;
      }

      setPhase("pending");
      pollForSettlement(0);
    } catch {
      setError("Network error — please try again");
      setPhase("error");
    }
  };

  const setPct = (pct: number) =>
    setAmount(String(Math.floor((coins * pct) / 100)));

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  const busy = phase === "submitting" || phase === "pending";

  return (
    <ModalShell
      show={show}
      onClose={handleClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={shrineIcon}
          title="Shrine"
          subtitle={`Convert coins to ${TOKEN_NAME}`}
          onClose={handleClose}
        />
      }
      actionDock={
        <ActionDock
          info={
            error ? (
              <span className="text-red-400 font-pixel text-[8px]">{error}</span>
            ) : (
              <span className="text-white/50 font-pixel text-[8px]">
                {formatCoins(coins)} coins available
              </span>
            )
          }
        >
          <button
            type="button"
            disabled={!validAmount || busy}
            onClick={handleWithdraw}
            className="wood-frame-light wood-panel-inner px-5 py-2 text-white text-shadow cursor-pointer hover:brightness-110 active:translate-y-0.5 transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed font-pixel text-[9px] tracking-widest"
            style={{ boxShadow: validAmount && !busy ? "0 0 0 3px #16a34a" : undefined }}
          >
            {phase === "submitting" ? "SENDING..." : phase === "pending" ? "SETTLING..." : "WITHDRAW"}
          </button>
        </ActionDock>
      }
      bodyClassName="px-2 pb-2"
    >
      <div className="flex flex-col gap-4 p-1">

        {/* Balance chip */}
        <div className="flex items-center gap-2 bg-black/30 px-3 py-2 rounded">
          <img src={tokenIcon} alt={TOKEN_NAME} width={24} height={24} className="object-contain pixelated" />
          <span className="font-pixel text-[10px] text-yellow-400">{formatCoins(coins)}</span>
          <span className="font-pixel text-[8px] text-white/40">coins</span>
        </div>

        {/* Amount input */}
        <div>
          <SectionLabel className="mb-2">Amount to withdraw</SectionLabel>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={coins}
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-black/40 px-3 py-2 rounded text-white outline-none focus:brightness-110 disabled:opacity-60 font-body text-xl"
          />
          {/* Percentage shortcuts */}
          <div className="flex gap-2 mt-2">
            {[25, 50, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={busy || coins < 1}
                onClick={() => setPct(pct)}
                className="wood-frame-light wood-panel-inner flex-1 py-1.5 text-white text-shadow cursor-pointer hover:brightness-110 active:translate-y-0.5 transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed font-pixel text-[8px]"
              >
                {pct === 100 ? "MAX" : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Summary row */}
        <div className="flex justify-between items-center bg-black/40 px-3 py-2 rounded">
          <span className="font-pixel text-[8px] text-white/50 tracking-widest">YOU RECEIVE</span>
          <div className="flex items-center gap-1.5">
            <img src={tokenIcon} alt={TOKEN_NAME} width={18} height={18} className="object-contain pixelated" />
            <span
              className="font-body text-xl"
              style={{ color: validAmount ? "#fbbf24" : "#dc2626" }}
            >
              {Number.isFinite(numeric) && numeric > 0 ? formatCoins(numeric) : "0"}
            </span>
            <span className="font-pixel text-[8px] text-white/40">{TOKEN_NAME}</span>
          </div>
        </div>

        {/* Pending status */}
        {phase === "pending" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-black/30" aria-live="polite">
            <div className="w-2 h-2 rounded-full shrink-0 bg-yellow-400 animate-pulse" />
            <span className="font-body text-base text-yellow-400">
              Queued — settling on Robinhood Chain...
            </span>
          </div>
        )}

        {/* Done status */}
        {phase === "done" && settledSig && (
          <div className="flex flex-col gap-1 px-3 py-2 rounded bg-black/30" aria-live="polite">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0 bg-green-400" />
              <span className="font-body text-base text-green-400">Withdrawal complete!</span>
            </div>
            <a
              href={`${EXPLORER_BASE}${settledSig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:brightness-125 underline font-body text-sm text-blue-300"
            >
              {shortHash(settledSig)}
            </a>
          </div>
        )}

        <p className="font-body text-sm text-white/40">
          Coins are converted to {TOKEN_NAME} and sent to your connected wallet by the
          treasury. Settlement is processed off-chain and confirmed on Robinhood Chain.
        </p>
      </div>
    </ModalShell>
  );
}

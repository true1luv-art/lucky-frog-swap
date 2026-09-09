"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWalletAdapter, type WalletType } from "@/lib/auth/use-wallet-adapter";
import { Panel, OuterPanel, InnerPanel } from "@/components/ui/Panel";
import { Tab } from "@/components/ui/Tab";
import { Button } from "@/components/ui/Button";

/**
 * Reads a Response safely: parses the body as JSON, or throws a
 * human-readable error when the body is empty or not valid JSON.
 * This prevents the cryptic "Unexpected end of JSON input" crash that
 * occurs when the server returns a 5xx with an empty body.
 */
async function safeJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(`Server error (${res.status}). Please try again.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Unexpected server response (${res.status}). Please try again.`);
  }
}

type Step =
  | "idle"
  | "ineligible"
  | "username"
  | "signing"
  | "checking"
  | "submitting"
  | "success";

export default function LoginPage() {
  const router = useRouter();
  const { connected, openWalletModal, connectAndSign, publicKey } = useWalletAdapter();

  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [wallet, setWallet] = useState("");
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [balance, setBalance] = useState(0);
  const [minHold, setMinHold] = useState(0);

  useEffect(() => {
    fetch("/api/auth/min-hold")
      .then((r) => safeJson<{ minHold?: number }>(r))
      .then((d) => {
        if (typeof d.minHold === "number") setMinHold(d.minHold);
      })
      .catch(() => { /* non-fatal */ });
  }, []);

  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "taken" | "available" | "invalid"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [signature, setSignature] = useState("");
  const [message, setMessage] = useState("");

  function reset() {
    setStep("idle");
    setErrorMsg("");
    setWallet("");
    setWalletType(null);
    setBalance(0);
    setUsername("");
    setUsernameStatus("idle");
    setSignature("");
    setMessage("");
  }

  async function handleConnect() {
    setErrorMsg("");
    if (!connected) {
      openWalletModal();
      return;
    }
    await handleSignAndLogin();
  }

  async function handleSignAndLogin() {
    setStep("signing");
    setErrorMsg("");

    let connectedWallet: string;
    let connectedWalletType: WalletType;
    let connectedSignature: string;
    let connectedMessage: string;

    try {
      const result = await connectAndSign();
      connectedWallet = result.wallet;
      connectedWalletType = result.walletType;
      connectedSignature = result.signature;
      connectedMessage = result.message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect wallet.";
      if (errorMessage.includes("not connected") || errorMessage.includes("No wallet")) {
        openWalletModal();
        setErrorMsg("Please select a wallet and try again.");
      } else {
        setErrorMsg(errorMessage);
      }
      setStep("idle");
      return;
    }

    setWallet(connectedWallet);
    setWalletType(connectedWalletType);
    setSignature(connectedSignature);
    setMessage(connectedMessage);

    setStep("checking");
    try {
      const res = await fetch(`/api/auth/check-balance?wallet=${encodeURIComponent(connectedWallet)}`);
      const data = await safeJson<{
        eligible: boolean;
        balance: number;
        minHold?: number;
        error?: string;
      }>(res);

      if (data.error && !data.eligible) throw new Error(data.error);

      setBalance(data.balance);
      if (typeof data.minHold === "number") setMinHold(data.minHold);

      if (!data.eligible) {
        setStep("ineligible");
        return;
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to check balance.");
      setStep("idle");
      return;
    }

    setStep("submitting");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: connectedWallet,
          walletType: connectedWalletType,
          signature: connectedSignature,
          message: connectedMessage,
        }),
      });
      const data = await safeJson<{
        status: string;
        token?: string;
        balance?: number;
        minHold?: number;
        error?: string;
      }>(res);

      if (data.status === "insufficient-balance") {
        if (typeof data.balance === "number") setBalance(data.balance);
        if (typeof data.minHold === "number") setMinHold(data.minHold);
        setStep("ineligible");
        return;
      }
      if (data.status === "balance-check-failed") {
        setErrorMsg("Couldn't verify your $LFRG balance. Please try again.");
        setStep("idle");
        return;
      }
      if (data.status === "not-registered") {
        setStep("username");
        return;
      }
      if (data.status === "ok" && data.token) {
        document.cookie = `lfrg_token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        setStep("success");
        router.push("/game");
        return;
      }

      if (data.status === "error") {
        setErrorMsg(data.error ?? "Authentication failed. Please try again.");
        setStep("idle");
        return;
      }

      setErrorMsg("Authentication failed. Please try again.");
      setStep("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to check registration.");
      setStep("idle");
    }
  }

  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    if (username.length > 24 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus("invalid");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setUsernameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
        const data = await safeJson<{ available: boolean; error?: string }>(res);
        if (data.error) { setUsernameStatus("invalid"); return; }
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
  }, [username]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (usernameStatus !== "available") return;

    setStep("signing");
    setErrorMsg("");

    let sig = signature;
    let msg = message;

    if (!sig) {
      try {
        const result = await connectAndSign();
        sig = result.signature;
        msg = result.message;
        setSignature(sig);
        setMessage(msg);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Wallet signing failed.");
        setStep("username");
        return;
      }
    }

    setStep("submitting");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, walletType, username, signature: sig, message: msg }),
      });
      const data = await safeJson<{
        status: string;
        token?: string;
        balance?: number;
        minHold?: number;
      }>(res);

      if ((data.status === "ok" || data.status === "already-registered") && data.token) {
        document.cookie = `lfrg_token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        setStep("success");
        router.push("/game");
        return;
      }
      if (data.status === "insufficient-balance") {
        if (typeof data.balance === "number") setBalance(data.balance);
        if (typeof data.minHold === "number") setMinHold(data.minHold);
        setStep("ineligible");
        return;
      }
      if (data.status === "balance-check-failed") {
        setErrorMsg("Couldn't verify your $LFRG balance. Please try again.");
        setStep("username");
        return;
      }
      if (data.status === "username-taken") {
        setUsernameStatus("taken");
        setStep("username");
        return;
      }
      if (data.status === "username-invalid" || data.status === "username-required") {
        setUsernameStatus("invalid");
        setErrorMsg("Username must be 3-24 characters. Letters, numbers and underscores only.");
        setStep("username");
        return;
      }
      setErrorMsg("Registration failed. Please try again.");
      setStep("username");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStep("username");
    }
  }

  const isLoading = ["signing", "checking", "submitting", "success"].includes(step);

  const connectLabel = (() => {
    if (step === "signing") return "Waiting for Signature...";
    if (step === "checking") return "Checking Balance...";
    if (step === "submitting") return "Authenticating...";
    if (!connected) return "Select Wallet";
    return "Connect & Sign";
  })();

  const stepLabel = step === "username"
    ? "New Miner"
    : "Wallet Sign-In";

  const headingLabel = step === "username"
    ? "Choose Your Miner Name"
    : step === "ineligible"
    ? "Insufficient Balance"
    : "Enter The Mine";

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden font-body bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/bg-login.png')" }}
    >
      {/* Dim overlay so panels read clearly over the background */}
      <div className="pointer-events-none absolute inset-0 bg-black/40" />

      <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:px-6">

        {/* Page header */}
        <div className="mb-8 text-center drop-shadow-lg">
          <p className="mb-1 font-pixel text-[10px] uppercase tracking-[0.4em] text-white/80">
            $LFRG
          </p>
          <h1 className="font-pixel text-2xl leading-tight text-white sm:text-3xl">
            LUCKY FROG MINE
          </h1>
          <p className="mt-2 font-pixel text-[10px] uppercase tracking-[0.3em] text-white/70">
            Play-to-Earn &middot; Idle Mining &middot; Solana
          </p>
        </div>

        {/* Main sign-in panel */}
        <div className="w-full max-w-lg">
          <OuterPanel className="pt-5 relative">
            {/* Tab header row — matches hearthvale modal header pattern */}
            <div className="flex items-center justify-between pl-3 pr-2">
              <div className="flex items-center">
                <Tab isActive onClick={() => {}}>
                  <span className="font-pixel text-[10px] uppercase tracking-widest text-white px-1">
                    {stepLabel}
                  </span>
                </Tab>
              </div>
              {/* Back button in top-right corner replacing the close X */}
              <Link
                href="/"
                className="group flex items-center gap-1.5 font-pixel text-[10px] uppercase tracking-widest text-white/70 hover:text-white transition-colors pb-1"
              >
                <svg
                  className="h-3 w-3 transition-transform group-hover:-translate-x-0.5"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </Link>
            </div>

            <InnerPanel className="p-6">
              <div className="space-y-6">

                {/* Heading */}
                <div className="text-center space-y-1">
                  <h2 className="font-pixel text-sm uppercase text-white">
                    {headingLabel}
                  </h2>
                  {wallet && step !== "ineligible" && (
                    <p className="text-sm text-white/70">
                      {walletType && (
                        <span className="capitalize font-semibold text-white">{walletType}</span>
                      )}{" "}
                      Wallet{" "}
                      <span className="font-mono text-white">
                        {wallet.slice(0, 5)}&hellip;{wallet.slice(-5)}
                      </span>{" "}
                      verified.
                    </p>
                  )}
                </div>

                {/* Step: idle */}
                {step === "idle" && (
                  <div className="space-y-4">
                    <Button onClick={handleConnect} disabled={isLoading}>
                      <span className="font-pixel text-[9px] uppercase tracking-widest py-1">
                        {connectLabel}
                      </span>
                    </Button>
                    <p className="text-center text-sm leading-relaxed text-white/70">
                      Phantom, Solflare &amp; more supported.{" "}
                      Signing is <span className="text-white font-semibold">free</span> — it never moves funds.
                    </p>
                    {/* Wallet badges */}
                    <div className="flex justify-center gap-6 pt-1 opacity-60">
                      {["Phantom", "Solflare", "Backpack"].map((w) => (
                        <span key={w} className="font-pixel text-[9px] uppercase tracking-wider text-white/80">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step: ineligible */}
                {step === "ineligible" && (
                  <div className="space-y-4">
                    <OuterPanel>
                      <InnerPanel className="p-3 text-center space-y-1">
                        <p className="text-sm leading-relaxed text-white/80">
                          Wallet{" "}
                          <span className="font-mono text-white">
                            {wallet.slice(0, 5)}&hellip;{wallet.slice(-5)}
                          </span>{" "}
                          holds{" "}
                          <span className="font-bold text-white">
                            {balance.toLocaleString()} $LFRG
                          </span>.
                        </p>
                        <p className="text-sm text-white/70">
                          You need{" "}
                          <span className="font-bold text-white">
                            {minHold.toLocaleString()} $LFRG
                          </span>{" "}
                          minimum.
                        </p>
                      </InnerPanel>
                    </OuterPanel>
                    <a
                      href="https://pump.fun/coin/rguPVQY61jq14vwShEaNuSiCXYGG3bwWzwa3XJHpump"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button>
                        <span className="font-pixel text-[9px] uppercase tracking-widest py-1">
                          Buy $LFRG on Pump.fun
                        </span>
                      </Button>
                    </a>
                    <button
                      type="button"
                      onClick={reset}
                      className="w-full text-center text-sm text-white/60 hover:text-white transition"
                    >
                      Try a different wallet
                    </button>
                  </div>
                )}

                {/* Step: username (new user) */}
                {step === "username" && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label
                        htmlFor="username"
                        className="mb-2 block font-pixel text-[10px] uppercase tracking-widest text-white/80"
                      >
                        Choose a username
                      </label>
                      <div className="relative">
                        <input
                          id="username"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                          maxLength={24}
                          placeholder="frog_king"
                          autoFocus
                          className="w-full bg-brown-600/80 border-2 border-brown-300/40 px-3 py-2 pr-12 font-body text-base text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
                        />
                        {usernameStatus === "checking" && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-pixel text-[8px] text-white/50">...</span>
                        )}
                        {usernameStatus === "available" && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-pixel text-[8px] text-white">OK</span>
                        )}
                        {usernameStatus === "taken" && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-pixel text-[8px] text-rose-400">TAKEN</span>
                        )}
                        {usernameStatus === "invalid" && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-pixel text-[8px] text-rose-400">!</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-white/50">
                        3-24 characters. Letters, numbers and underscores only.
                      </p>
                    </div>
                    <Button type="submit" disabled={usernameStatus !== "available" || isLoading}>
                      <span className="font-pixel text-[9px] uppercase tracking-widest py-1">
                        {isLoading ? "Signing..." : "Enter the Mine"}
                      </span>
                    </Button>
                  </form>
                )}

                {/* Step: signing */}
                {step === "signing" && (
                  <div className="space-y-3 text-center">
                    <p className="text-sm leading-relaxed text-white/70">
                      Check your wallet and approve the signature request. This does not cost any SOL.
                    </p>
                    <p className="font-pixel text-[9px] uppercase tracking-widest text-white/50 animate-pulse">
                      Waiting for signature...
                    </p>
                  </div>
                )}

                {/* Step: checking */}
                {step === "checking" && (
                  <div className="text-center">
                    <p className="font-pixel text-[9px] uppercase tracking-widest text-white/50 animate-pulse">
                      Checking $LFRG balance...
                    </p>
                  </div>
                )}

                {/* Step: submitting / success */}
                {(step === "submitting" || step === "success") && (
                  <div className="text-center">
                    <p className="font-pixel text-[9px] uppercase tracking-widest text-white animate-pulse">
                      {step === "success" ? "Welcome to the mine..." : "Authenticating..."}
                    </p>
                  </div>
                )}

                {/* Error */}
                {errorMsg && (
                  <OuterPanel>
                    <InnerPanel className="p-3 text-center">
                      <p className="text-sm leading-relaxed text-rose-300">{errorMsg}</p>
                    </InnerPanel>
                  </OuterPanel>
                )}

              </div>
            </InnerPanel>
          </OuterPanel>

          {/* Token gate notice */}
          <div className="mt-4">
            <OuterPanel>
              <InnerPanel className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="mb-0.5 font-pixel text-[7px] uppercase tracking-[0.2em] text-white/60">
                      Token Gate
                    </p>
                    <p className="text-sm leading-relaxed text-white/70">
                      You need at least{" "}
                      <span className="font-bold text-white">
                        {minHold > 0 ? `${minHold.toLocaleString()} $LFRG` : "... $LFRG"}
                      </span>{" "}
                      to enter the mine. One wallet per miner.
                    </p>
                  </div>
                </div>
              </InnerPanel>
            </OuterPanel>
          </div>
        </div>

      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------



'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter }                    from 'next/navigation';
import {
  subscribeToEIP6963Wallets,
  connectAndSignRobinhood,
  WrongChainError,
  ROBINHOOD_CHAIN_ID_DEC,
  ROBINHOOD_CHAIN_NAME,
  ROBINHOOD_RPC_URL,
  ROBINHOOD_EXPLORER_URL,
  type EIP6963Provider,
} from '@/lib/auth/wallet-adapters/robinhood';
import { LoginCard }    from './LoginCard';
import { WalletButton } from './LoginSolana';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthResponse {
  success?: boolean;
  error?:   string;
  code?:    string;
  status?:  string;
  player?:  { wallet: string; username: string | null; coins: number };
  token?:   string;
}

type Step = 'idle' | 'signing' | 'wrong-chain' | 'submitting';

// ---------------------------------------------------------------------------
// Cookie setter
// ---------------------------------------------------------------------------

function setAuthCookie(token: string) {
  document.cookie = `rhf_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

// ---------------------------------------------------------------------------
// Skeleton placeholder while wallet discovery runs
// ---------------------------------------------------------------------------

function WalletSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-12 border border-white/10 rounded animate-pulse"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LoginRobinhoodProps {
  tokenName?: string;
}

export function LoginRobinhood({ tokenName = '$LFRG' }: LoginRobinhoodProps) {
  const router = useRouter();

  const [wallets,           setWallets]           = useState<EIP6963Provider[]>([]);
  const [scanned,           setScanned]           = useState(false);
  const [step,              setStep]              = useState<Step>('idle');
  const [error,             setError]             = useState('');
  const [wrongChainWallet,  setWrongChainWallet]  = useState('');
  const [signingWalletName, setSigningWalletName] = useState('');
  const [busyWallet,        setBusyWallet]        = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cleanupRef.current = subscribeToEIP6963Wallets((list) => {
      // Filter out pure Solana injections (Phantom announces as both Solana
      // and EVM — exclude its Solana-only rdns so it doesn't appear here).
      const SOLANA_ONLY_RDNS = new Set(['app.phantom.solana', 'com.solflare.solana']);
      const evmWallets = list.filter((w) => !SOLANA_ONLY_RDNS.has(w.info.rdns));

      // Sort MetaMask to the top, then alphabetical
      const sorted = [...evmWallets].sort((a, b) => {
        if (a.info.rdns === 'io.metamask') return -1;
        if (b.info.rdns === 'io.metamask') return  1;
        return a.info.name.localeCompare(b.info.name);
      });

      setWallets(sorted);
      setScanned(true);
    });
    // Give EIP-6963 wallets up to 600 ms to announce themselves
    const t = setTimeout(() => setScanned(true), 600);
    return () => { clearTimeout(t); cleanupRef.current?.(); };
  }, []);

  function reset() {
    setStep('idle');
    setError('');
    setWrongChainWallet('');
    setSigningWalletName('');
    setBusyWallet('');
  }

  async function handleSelectWallet(selected: EIP6963Provider) {
    setError('');
    setStep('signing');
    setSigningWalletName(selected.info.name);
    setBusyWallet(selected.info.uuid);

    let result: Awaited<ReturnType<typeof connectAndSignRobinhood>>;
    try {
      result = await connectAndSignRobinhood(selected);
    } catch (err) {
      if (err instanceof WrongChainError) {
        setWrongChainWallet(selected.info.name);
        setStep('wrong-chain');
        setBusyWallet('');
        return;
      }
      setError(err instanceof Error ? err.message : 'Wallet connection failed.');
      reset();
      return;
    }

    setStep('submitting');
    setBusyWallet('');

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          wallet:    result.wallet,
          signature: result.signature,
          message:   result.message,
        }),
      });
      const data = await res.json() as AuthResponse;

      // Auto-register new players
      if (!res.ok && (data.code === 'NOT_REGISTERED' || data.status === 'not-registered')) {
        const regRes  = await fetch('/api/auth/register', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            wallet:    result.wallet,
            signature: result.signature,
            message:   result.message,
          }),
        });
        const regData = await regRes.json() as AuthResponse;
        if (!regRes.ok) {
          setError(regData.error ?? 'Registration failed.');
          reset();
          return;
        }
        if (regData.token) setAuthCookie(regData.token);
        router.push('/game');
        return;
      }

      if (!res.ok) {
        setError(data.error ?? 'Authentication failed.');
        reset();
        return;
      }

      if (data.token) setAuthCookie(data.token);
      router.push('/game');
    } catch {
      setError('Network error. Please try again.');
      reset();
    }
  }

  // ---- Wrong-chain state fills the whole card body -------------------------
  if (step === 'wrong-chain') {
    return (
      <LoginCard chainLabel="Robinhood Chain" error={error}>
        <p className="font-body text-sm text-white/70">
          <span className="text-yellow-400">{wrongChainWallet}</span> is on the wrong network.
          Add Robinhood Chain manually:
        </p>
        <div className="flex flex-col gap-2 p-3 border border-white/10 rounded text-xs">
          {([
            ['Network',  ROBINHOOD_CHAIN_NAME],
            ['Chain ID', String(ROBINHOOD_CHAIN_ID_DEC)],
            ['RPC URL',  ROBINHOOD_RPC_URL],
            ['Currency', 'ETH'],
            ['Explorer', ROBINHOOD_EXPLORER_URL],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <div className="font-pixel text-[7px] text-white/40 mb-0.5 uppercase tracking-wider">{label}</div>
              <div className="font-body text-white/80 break-all">{value}</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={reset}
          className="py-2 border border-yellow-400/60 font-pixel text-[9px] text-yellow-400 hover:border-yellow-400 bg-transparent cursor-pointer tracking-wider w-full"
        >
          TRY AGAIN
        </button>
      </LoginCard>
    );
  }

  // ---- Submitting state ----------------------------------------------------
  if (step === 'submitting') {
    return (
      <LoginCard chainLabel="Robinhood Chain" error={error}>
        <div className="py-3 text-center">
          <p className="font-pixel text-[9px] text-yellow-400 tracking-widest animate-pulse">
            AUTHENTICATING...
          </p>
        </div>
      </LoginCard>
    );
  }

  // ---- Signing state — still shows wallets, the active one shows busy ------
  // ---- Idle / default — wallet list ----------------------------------------
  return (
    <LoginCard chainLabel="Robinhood Chain" error={error}>
      <div className="flex flex-col gap-2">

        {/* Skeleton while EIP-6963 discovery is running */}
        {!scanned && <WalletSkeleton />}

        {/* No wallets found — prompt to install MetaMask */}
        {scanned && wallets.length === 0 && (
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-3 border border-white/10 rounded hover:border-yellow-400/60 hover:bg-white/5 transition-colors cursor-pointer no-underline"
          >
            {/* MetaMask fox icon via SVG data URI */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
              alt="MetaMask"
              width={28}
              height={28}
              className="object-contain"
            />
            <div className="flex-1 min-w-0">
              <p className="font-pixel text-[10px] text-white leading-none tracking-wide">MetaMask</p>
              <p className="font-body text-xs text-white/50 mt-0.5">Install MetaMask to continue</p>
            </div>
            <span className="text-white/30 text-sm">→</span>
          </a>
        )}

        {/* Wallet rows — same style as old Solana layout */}
        {scanned && wallets.map((w) => (
          <WalletButton
            key={w.info.uuid}
            name={w.info.name}
            icon={w.info.icon}
            subtitle="Robinhood Chain"
            onClick={() => handleSelectWallet(w)}
            busy={step === 'signing' && busyWallet === w.info.uuid}
            disabled={step === 'signing'}
          />
        ))}

        {/* Signing hint */}
        {step === 'signing' && (
          <p className="font-body text-xs text-white/50 text-center pt-1">
            Approve the signature in{' '}
            <span className="text-yellow-400">{signingWalletName}</span>
            {' '}— free, no gas.
          </p>
        )}

      </div>
    </LoginCard>
  );
}

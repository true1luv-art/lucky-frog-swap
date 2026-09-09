'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  subscribeToSolanaWallets,
  signInWithSolanaWallet,
  type DetectedSolanaWallet,
} from '@/lib/auth/wallet-adapters/solana';
import { LoginCard } from './LoginCard';

export function WalletButton({
  name, icon, subtitle, onClick, busy, disabled,
}: {
  name:     string;
  icon:     string;
  subtitle: string;
  onClick:  () => void;
  busy:     boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 w-full px-3 py-2 text-left bg-brown-300/60 border border-white/10 rounded-sm hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      {icon ? (
        <img src={icon} alt="" width={32} height={32} className="rounded flex-shrink-0" />
      ) : (
        <span className="w-8 h-8 bg-white/10 rounded flex items-center justify-center font-pixel text-xs text-white flex-shrink-0">
          {name[0]}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-pixel text-[10px] text-white tracking-wide">{name}</div>
        <div className="font-body text-xs text-white/50">{subtitle}</div>
      </div>
      <span className="font-pixel text-[8px] text-white/60 flex-shrink-0">
        {busy ? '...' : '→'}
      </span>
    </button>
  );
}

interface LoginData {
  status?: string;
  token?: string;
  error?: string;
}

function setAuthCookie(token: string) {
  document.cookie = `rhf_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

export function LoginSolana() {
  const router = useRouter();

  const [wallets, setWallets] = useState<DetectedSolanaWallet[]>([]);
  const [scanned, setScanned] = useState(false);
  const [busy,    setBusy]    = useState<string | null>(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const unsub = subscribeToSolanaWallets((list) => {
      setWallets(list);
      setScanned(true);
    });
    // Give Wallet Standard up to 600ms to announce wallets on first render
    const t = setTimeout(() => setScanned(true), 600);
    return () => { clearTimeout(t); unsub(); };
  }, []);

  async function connect(w: DetectedSolanaWallet) {
    setError('');
    setBusy(w.name);
    try {
      const result = await signInWithSolanaWallet(w.wallet);

      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          wallet:    result.wallet,
          signature: result.signature,
          message:   result.message,
        }),
      });
      const data = await res.json() as LoginData;

      if (data.status === 'not-registered') {
        // Auto-register new Solana wallets
        const regRes  = await fetch('/api/auth/register', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            wallet:    result.wallet,
            signature: result.signature,
            message:   result.message,
          }),
        });
        const regData = await regRes.json() as LoginData;
        if (regData.status !== 'ok') {
          setError(regData.error ?? 'Registration failed. Try again.');
          return;
        }
        if (regData.token) setAuthCookie(regData.token);
        router.push('/game');
        return;
      }
      if (data.status !== 'ok') {
        setError(data.error ?? 'Authentication failed. Try again.');
        return;
      }
      if (data.token) setAuthCookie(data.token);
      router.push('/game');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <LoginCard chainLabel="Solana" error={error}>
      <div className="flex flex-col gap-2">
        {!scanned && <WalletSkeleton />}

        {scanned && wallets.length === 0 && (
          <div className="py-4 px-3 border border-white/10 rounded text-center">
            <p className="text-white/60 text-xs font-body">
              No Solana wallets detected.
            </p>
            <p className="text-white/40 text-xs font-body mt-1">
              Install Phantom, Solflare, or Backpack and reload.
            </p>
          </div>
        )}

        {wallets.map((w) => (
          <WalletButton
            key={w.name}
            name={w.name}
            icon={w.icon}
            subtitle="Solana"
            onClick={() => connect(w)}
            busy={busy === w.name}
            disabled={!!busy}
          />
        ))}
      </div>
    </LoginCard>
  );
}

function WalletSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-12 bg-white/5 border border-white/10 rounded animate-pulse"
        />
      ))}
    </div>
  );
}

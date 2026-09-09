'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BootstrapPayload } from '@/features/store/gameStore';
import { useGameStore } from '@/features/store/gameStore';
import {
  subscribeToSolanaWallets,
  signInWithSolanaWallet,
  type DetectedWallet,
} from '@/lib/auth/wallet-adapters/solana';
import { LoginCard } from './LoginCard';

const gold      = '#facc15';
const cream     = '#f5e9c4';
const pixelFont = "'Press Start 2P', monospace";
const bodyFont  = "'VT323', monospace";

interface AuthResponse {
  success?: boolean;
  error?:   string;
  code?:    string;
  player?:  BootstrapPayload['player'];
  token?:   string;
}

export function LoginSolana() {
  const router  = useRouter();
  const hydrate = useGameStore((s) => s.hydrate);

  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [scanned, setScanned] = useState(false);
  const [busy,    setBusy]    = useState<string | null>(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const unsub = subscribeToSolanaWallets((list) => {
      setWallets(list);
      setScanned(true);
    });
    const t = setTimeout(() => setScanned(true), 600);
    return () => { clearTimeout(t); unsub(); };
  }, []);

  async function connect(w: DetectedWallet) {
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
      const data = await res.json() as AuthResponse;

      if (!res.ok && data.code === 'NOT_REGISTERED') {
        // Auto-register new players.
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
          setError(regData.error ?? 'Registration failed. Try again.');
          return;
        }
        if (regData.token) localStorage.setItem('bm_token', regData.token);
        if (regData.player) hydrate({ player: regData.player, heroes: [] });
        router.push('/game');
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'Authentication failed. Try again.');
        return;
      }
      if (data.token) localStorage.setItem('bm_token', data.token);
      if (data.player) hydrate({ player: data.player, heroes: [] });
      router.push('/game');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <LoginCard chainLabel="Solana" error={error}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!scanned && <WalletSkeleton />}

        {scanned && wallets.length === 0 && (
          <div style={{
            padding: '20px 16px',
            border: '1px dashed rgba(245,233,196,0.2)',
            textAlign: 'center',
          }}>
            <p style={{ fontFamily: bodyFont, fontSize: 18, color: cream, opacity: 0.7, margin: 0 }}>
              No Solana wallets detected.
            </p>
            <p style={{ fontFamily: bodyFont, fontSize: 16, color: cream, opacity: 0.5, marginTop: 6 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            height: 56,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(245,233,196,0.1)',
          }}
        />
      ))}
    </div>
  );
}

export function WalletButton({
  name, icon, subtitle, onClick, busy, disabled,
}: {
  name: string; icon: string; subtitle: string;
  onClick: () => void; busy: boolean; disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '12px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(245,233,196,0.2)',
        opacity: disabled && !busy ? 0.5 : 1,
        textAlign: 'left', transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = gold; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(245,233,196,0.2)'; }}
    >
      {icon
        ? <img src={icon} alt="" style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0 }} />
        : <span style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)', borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: pixelFont, fontSize: 12, color: gold }}>{name[0]}</span>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: pixelFont, fontSize: 10, color: cream, letterSpacing: 1 }}>{name}</div>
        <div style={{ fontFamily: bodyFont, fontSize: 14, color: cream, opacity: 0.5, marginTop: 2 }}>{subtitle}</div>
      </div>
      <span style={{ fontFamily: pixelFont, fontSize: 8, color: gold, letterSpacing: 1, flexShrink: 0 }}>
        {busy ? '...' : 'CONNECT →'}
      </span>
    </button>
  );
}

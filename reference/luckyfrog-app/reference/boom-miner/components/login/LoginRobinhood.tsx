'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, type BootstrapPayload } from '@/features/store/gameStore';
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
import { LoginCard } from './LoginCard';
import { WalletButton } from './LoginSolana';

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

type Step = 'idle' | 'picking' | 'signing' | 'wrong-chain' | 'submitting';

export function LoginRobinhood() {
  const router  = useRouter();
  const hydrate = useGameStore((s) => s.hydrate);

  const [wallets,           setWallets]           = useState<EIP6963Provider[]>([]);
  const [step,              setStep]              = useState<Step>('idle');
  const [error,             setError]             = useState('');
  const [wrongChainWallet,  setWrongChainWallet]  = useState('');
  const [signingWalletName, setSigningWalletName] = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cleanupRef.current = subscribeToEIP6963Wallets(setWallets);
    return () => { cleanupRef.current?.(); };
  }, []);

  function reset() {
    setStep('idle');
    setError('');
    setWrongChainWallet('');
    setSigningWalletName('');
  }

  async function handleSelectWallet(selected: EIP6963Provider) {
    setError('');
    setStep('signing');
    setSigningWalletName(selected.info.name);

    let result: Awaited<ReturnType<typeof connectAndSignRobinhood>>;
    try {
      result = await connectAndSignRobinhood(selected);
    } catch (err) {
      if (err instanceof WrongChainError) {
        setWrongChainWallet(selected.info.name);
        setStep('wrong-chain');
        return;
      }
      setError(err instanceof Error ? err.message : 'Wallet connection failed.');
      setStep('picking');
      return;
    }

    setStep('submitting');
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
          setError(regData.error ?? 'Registration failed.');
          setStep('picking');
          return;
        }
        if (regData.token) localStorage.setItem('bm_token', regData.token);
        if (regData.player) hydrate({ player: regData.player, heroes: [] });
        router.push('/game');
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'Authentication failed.');
        setStep('picking');
        return;
      }
      if (data.token) localStorage.setItem('bm_token', data.token);
      if (data.player) hydrate({ player: data.player, heroes: [] });
      router.push('/game');
    } catch {
      setError('Network error. Try again.');
      setStep('picking');
    }
  }

  return (
    <LoginCard chainLabel="Robinhood Chain" error={error}>

      {/* Idle — single CTA */}
      {step === 'idle' && (
        <button
          type="button"
          onClick={() => setStep('picking')}
          style={{
            width: '100%', padding: '18px 24px',
            background: gold, color: '#000',
            border: '4px solid #000', boxShadow: '6px 6px 0 #000',
            fontFamily: pixelFont, fontSize: 12, letterSpacing: 1, cursor: 'pointer',
          }}
        >
          CONNECT WALLET
        </button>
      )}

      {/* Picking */}
      {step === 'picking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {wallets.length === 0 ? (
            <p style={{ fontFamily: bodyFont, fontSize: 18, color: cream, opacity: 0.7, textAlign: 'center', padding: '12px 0' }}>
              No EIP-6963 wallets detected. Install MetaMask, Rabby, or a Robinhood Chain-compatible wallet.
            </p>
          ) : (
            wallets.map((w) => (
              <WalletButton
                key={w.info.uuid}
                name={w.info.name}
                icon={w.info.icon}
                subtitle="Robinhood Chain"
                onClick={() => handleSelectWallet(w)}
                busy={false}
                disabled={false}
              />
            ))
          )}
          <button
            type="button"
            onClick={reset}
            style={{ fontFamily: pixelFont, fontSize: 8, color: cream, opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}
          >
            CANCEL
          </button>
        </div>
      )}

      {/* Signing */}
      {step === 'signing' && (
        <p style={{ fontFamily: bodyFont, fontSize: 20, color: cream, textAlign: 'center', padding: '12px 0' }}>
          Check <strong style={{ color: gold }}>{signingWalletName}</strong> and approve the signature request.
        </p>
      )}

      {/* Wrong chain */}
      {step === 'wrong-chain' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: bodyFont, fontSize: 18, color: cream }}>
            <strong style={{ color: gold }}>{wrongChainWallet}</strong> is not on Robinhood Chain. Add it manually:
          </p>
          <div style={{ padding: '12px 16px', border: '1px solid rgba(245,233,196,0.15)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {([
              ['Network',  ROBINHOOD_CHAIN_NAME],
              ['Chain ID', String(ROBINHOOD_CHAIN_ID_DEC)],
              ['RPC URL',  ROBINHOOD_RPC_URL],
              ['Currency', 'ETH'],
              ['Explorer', ROBINHOOD_EXPLORER_URL],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <div style={{ fontFamily: pixelFont, fontSize: 7, color: cream, opacity: 0.5, marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: bodyFont, fontSize: 16, color: cream, wordBreak: 'break-all' }}>{value}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            style={{ padding: '10px', background: 'transparent', border: `1px solid ${gold}`, fontFamily: pixelFont, fontSize: 9, color: gold, cursor: 'pointer', letterSpacing: 1 }}
          >
            TRY AGAIN
          </button>
        </div>
      )}

      {/* Submitting */}
      {step === 'submitting' && (
        <p style={{ fontFamily: pixelFont, fontSize: 9, color: gold, letterSpacing: 1, textAlign: 'center', padding: '12px 0' }}>
          AUTHENTICATING...
        </p>
      )}

    </LoginCard>
  );
}

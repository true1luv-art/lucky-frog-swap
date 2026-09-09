'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithHiveKeychain,
  isHiveKeychainAvailable,
} from '@/lib/auth/wallet-adapters/hive';
import { Button } from '@/components/ui/Button';
import { LoginCard } from './LoginCard';

interface LoginData {
  status?: string;
  token?:  string;
  error?:  string;
}

function setAuthCookie(token: string) {
  document.cookie = `rhf_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

export function LoginHive() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Server-rendered: assume available until the client confirms otherwise.
  const keychainAvailable =
    typeof window !== 'undefined' ? isHiveKeychainAvailable() : true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError('Enter your Hive username.');
      return;
    }
    if (!isHiveKeychainAvailable()) {
      setError('Hive Keychain extension not found. Install it from hive-keychain.com.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const result = await signInWithHiveKeychain(username.trim());

      // Attempt login
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          wallet:    result.wallet,
          signature: result.signature,
          message:   result.message,
          walletType: 'hive',
        }),
      });
      const data = await res.json() as LoginData;

      if (data.status === 'not-registered') {
        // First-time Hive user — auto-register
        const regRes  = await fetch('/api/auth/register', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            wallet:    result.wallet,
            signature: result.signature,
            message:   result.message,
            username:  result.wallet,  // Hive username as display name
            walletType: 'hive',
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
      setError(e instanceof Error ? e.message : 'Keychain signing failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginCard chainLabel="Hive Blockchain" error={error}>

      {/* Keychain not installed warning */}
      {!keychainAvailable && (
        <div className="border border-red-400/30 bg-red-900/20 rounded p-3 mb-2">
          <p className="text-red-400 text-xs font-body">
            Hive Keychain is not installed.{' '}
            <a
              href="https://hive-keychain.com"
              target="_blank"
              rel="noreferrer"
              className="underline text-yellow-300"
            >
              Get it here.
            </a>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="font-pixel text-[9px] text-white/70 uppercase tracking-widest">
          Hive Username
        </label>

        <div className="flex">
          <span className="flex items-center px-3 bg-white/5 border border-white/15 border-r-0 font-body text-lg text-yellow-300 flex-shrink-0">
            @
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.replace(/\s/g, '').toLowerCase())
            }
            placeholder="youraccount"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/15 font-body text-base text-white outline-none placeholder:text-white/30 focus:border-white/30 transition-colors"
          />
        </div>

        <p className="text-white/50 text-xs font-body leading-snug">
          Hive Keychain will prompt you to sign a message with your Posting key.
          No tokens are spent.
        </p>

        <Button type="submit" disabled={loading || !keychainAvailable}>
          {loading ? 'Waiting for Keychain...' : 'Sign In with Hive'}
        </Button>
      </form>

    </LoginCard>
  );
}

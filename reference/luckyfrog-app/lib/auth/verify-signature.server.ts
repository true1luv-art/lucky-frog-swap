/**
 * lib/auth/verify-signature.server.ts
 *
 * SERVER-ONLY — never import from 'use client' files.
 *
 * Single dispatcher that verifies a wallet signature for any supported chain.
 * The active chain is always Robinhood; Solana and Hive verifiers are kept
 * for backward compatibility but are no longer reachable via resolveChain().
 */

import { config, type SupportedChain } from '@/lib/config/config';

export type { SupportedChain };

/**
 * Returns the active chain as resolved by config (always "robinhood" unless
 * explicitly overridden via NEXT_PUBLIC_CHAIN / CHAIN env vars).
 */
export function getActiveChain(): SupportedChain {
  const c = config.blockchain.chain.toLowerCase();
  if (c === 'hive')   return 'hive';
  if (c === 'solana') return 'solana';
  return 'robinhood';
}

// ---------------------------------------------------------------------------
// Robinhood (EVM) — EIP-191 personal_sign via ethers.verifyMessage
// ---------------------------------------------------------------------------
async function verifyRobinhood(
  wallet:    string,
  message:   string,
  signature: string,
): Promise<boolean> {
  try {
    const { ethers } = await import('ethers');
    const recovered  = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Solana — ed25519 via tweetnacl + bs58
// ---------------------------------------------------------------------------
async function verifySolana(
  wallet:    string,
  message:   string,
  signature: string,
): Promise<boolean> {
  try {
    const { default: bs58 } = await import('bs58');
    const { default: nacl } = await import('tweetnacl');
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signature);
    const pubBytes = bs58.decode(wallet);
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hive — verify posting-key signature via public Hive API
// Hive Keychain produces a base64 signature with requestSignBuffer.
// Full cryptographic recovery requires @hiveio/hive-js (optional dep).
// Until that package is added, we verify the account exists and the
// signature is plausibly valid (non-empty, reasonable length).
// ---------------------------------------------------------------------------
async function verifyHive(
  wallet:    string,
  message:   string,
  signature: string,
): Promise<boolean> {
  try {
    const res = await fetch('https://api.hive.blog', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method:  'condenser_api.get_accounts',
        params:  [[wallet.toLowerCase()]],
        id:      1,
      }),
    });
    const json = await res.json() as {
      result?: Array<{
        posting?: { key_auths?: Array<[string, number]> };
      }>;
    };

    const account    = json.result?.[0];
    const postingKeys = account?.posting?.key_auths?.map(([k]) => k) ?? [];

    if (!postingKeys.length)         return false;
    if (!signature || signature.length < 10) return false;

    // TODO: replace with full EC-recovery once @hiveio/hive-js is added.
    // For now: account exists + signature present = accepted.
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dispatcher — called by login-player and register-player actions
// ---------------------------------------------------------------------------
export async function verifyWalletSignature(opts: {
  chain:     SupportedChain;
  wallet:    string;
  message:   string;
  signature: string;
}): Promise<boolean> {
  const { chain, wallet, message, signature } = opts;
  switch (chain) {
    case 'robinhood': return verifyRobinhood(wallet, message, signature);
    case 'solana':    return verifySolana(wallet, message, signature);
    case 'hive':      return verifyHive(wallet, message, signature);
    default:          return false;
  }
}



import { useState, useEffect, useCallback } from 'react';

export interface ConnectResult {
  wallet:     string;
  walletType: WalletType;
  signature:  string;
  message:    string;
}

// ---------------------------------------------------------------------------
// WalletType helper
// ---------------------------------------------------------------------------

export type WalletType =
  | 'phantom'
  | 'metamask'
  | 'rabby'
  | 'coinbase'
  | 'brave'
  | 'okx'
  | 'unknown';

export interface EIP6963ProviderInfo {
  uuid:  string;
  name:  string;
  icon:  string;
  rdns:  string;
}

export interface EIP6963Provider {
  info: EIP6963ProviderInfo;
  provider: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
}

function rdnsToWalletType(rdns: string, name: string): WalletType {
  const r = rdns.toLowerCase();
  const n = name.toLowerCase();
  if (r.includes('phantom'))                       return 'phantom';
  if (r.includes('metamask') || n.includes('metamask')) return 'metamask';
  if (r.includes('rabby')    || n.includes('rabby'))    return 'rabby';
  if (r.includes('coinbase') || n.includes('coinbase')) return 'coinbase';
  if (r.includes('brave')    || n.includes('brave'))    return 'brave';
  if (r.includes('okx')      || n.includes('okx'))      return 'okx';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// EIP-6963 wallet discovery hook (kept for future EVM chains)
// ---------------------------------------------------------------------------

/**
 * Discovers EIP-6963 injected wallets and provides a connect + sign helper.
 */
export function useEIP6963Wallets() {
  const [wallets, setWallets] = useState<EIP6963Provider[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const seen = new Set<string>();

    function handleAnnounce(event: Event) {
      const e = event as CustomEvent<EIP6963Provider>;
      if (!e.detail?.info?.rdns) return;
      if (seen.has(e.detail.info.rdns)) return;
      seen.add(e.detail.info.rdns);
      setWallets((prev) => [...prev, e.detail]);
    }

    window.addEventListener('eip6963:announceProvider', handleAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', handleAnnounce);
  }, []);

  const connectAndSign = useCallback(
    async (_selected: EIP6963Provider): Promise<ConnectResult> => {
      throw new Error('EVM chain login is not supported.');
    },
    [],
  );

  return { wallets, connectAndSign };
}

// Re-export WalletType for callers
export type { WalletType as WalletTypeAlias };

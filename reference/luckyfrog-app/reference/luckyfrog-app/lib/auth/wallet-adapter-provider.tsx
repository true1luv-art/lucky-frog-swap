'use client';

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * WalletAdapterProvider wraps the entire app with Solana Wallet Adapter.
 * This enables multi-wallet support with automatic wallet detection and selection.
 *
 * Supported wallets:
 * - Phantom (desktop, mobile, extension)
 * - Solflare (desktop, mobile, extension)
 * - Backpack (desktop, mobile, extension)
 * - And other Wallet Standard compliant wallets
 */
export function WalletAdapterProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_RPC_ENDPOINT ||
      'https://api.mainnet-beta.solana.com',
    []
  );

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

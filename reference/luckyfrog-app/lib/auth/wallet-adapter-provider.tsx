'use client';

import React from 'react';

/**
 * EIP-6963 wallet discovery requires no React context provider —
 * wallets announce themselves via window events.
 * This wrapper is kept as a pass-through for layout compatibility.
 */
export function WalletAdapterProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

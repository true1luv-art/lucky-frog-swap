/**
 * Minimal Phantom wallet type declarations.
 * Extends the global Window interface so TypeScript knows about window.phantom.
 */

interface PhantomSolanaProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (
    message: Uint8Array,
    encoding: string,
  ) => Promise<{ signature: Uint8Array }>;
  disconnect: () => Promise<void>;
  /** Signs the transaction and broadcasts it; returns the tx signature string. */
  signAndSendTransaction?: (tx: unknown) => Promise<{ signature: string }>;
  /** Signs the transaction without broadcasting; returns the signed tx. */
  signTransaction?: (tx: unknown) => Promise<unknown>;
}

declare global {
  interface Window {
    solana?: PhantomSolanaProvider;
    phantom?: {
      solana?: PhantomSolanaProvider;
    };
  }
}

export {};
